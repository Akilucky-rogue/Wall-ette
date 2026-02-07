import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Transaction, TransactionType, CurrencyCode, IgnoreRule } from '../types';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, serverTimestamp, writeBatch, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { CURRENCIES } from '../currencyUtils';

interface WalletContextType {
  transactions: Transaction[];
  currency: CurrencyCode;
  ignoreRules: IgnoreRule[];
  dailyLimit: number;
  mfaEnabled: boolean;
  isOnline: boolean;
  isCloudSyncing: boolean;
  openingBalance: number;
  setCurrency: (code: CurrencyCode) => void;
  setDailyLimit: (limit: number) => void;
  setMfaEnabled: (enabled: boolean) => void;
  setOpeningBalance: (balance: number) => void;
  addTransaction: (transaction: Transaction) => Promise<boolean>;
  editTransaction: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => void;
  clearAllTransactions: () => Promise<void>;
  importTransactions: (newTransactions: Transaction[]) => void;
  toggleIgnoreRule: (id: string) => void;
  getBalance: () => number;
  getMonthlyIncome: () => number;
  getMonthlyExpense: () => number;
  getTotalIncome: () => number;
  getTotalExpense: () => number;
  formatAmount: (amountInBase: number) => string;
  convertToBase: (amount: number) => number;
  retryCloudConnection: () => void;
  lastLoginTime: Date | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

const DEFAULT_RULES: IgnoreRule[] = [
  { id: '1', name: "Internal Transfers", description: "Wallet-to-Wallet", icon: "swap_horiz", color: "sage", isActive: true },
  { id: '2', name: "Tax Reserve", description: "Automated Sinking", icon: "account_balance", color: "rose", isActive: true },
  { id: '3', name: "Business Expenses", description: "Reimbursable", icon: "domain", color: "ocean", isActive: false },
  { id: '4', name: "Network Fees", description: "Gas & Overhead", icon: "token", color: "sand", isActive: true }
];

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currency, setCurrencyState] = useState<CurrencyCode>('INR');
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([]);
  const [dailyLimit, setDailyLimitState] = useState<number>(0);
  const [mfaEnabled, setMfaEnabledState] = useState<boolean>(false);
  const [lastLoginTime, setLastLoginTime] = useState<Date | null>(null);
  const [openingBalance, setOpeningBalanceState] = useState<number>(0);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Backend ready state to handle cases where DB doesn't exist
  const [isBackendReady, setIsBackendReady] = useState(true); 
  
  // Exchange Rates State (Base: INR)
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ 
      INR: 1, 
      USD: 0.012, 
      EUR: 0.011, 
      GBP: 0.0095 
  });

  // Monitor Online Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Live Rates
  useEffect(() => {
    const fetchRates = async () => {
        if (!isOnline) return;
        try {
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
            if (res.ok) {
                const data = await res.json();
                setExchangeRates(prev => ({ ...prev, ...data.rates }));
            }
        } catch (e) { 
            console.warn("Rate fetch failed, using fallbacks", e); 
        }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 3600000); // Update every hour
    return () => clearInterval(interval);
  }, [isOnline]);

  // Helper: Format Amount based on active currency and live rate
  const formatAmount = (amountInBase: number): string => {
      const rate = exchangeRates[currency] || CURRENCIES[currency].rate || 1;
      const converted = amountInBase * rate;
      const config = CURRENCIES[currency];
      
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(converted);
  };

  // Helper: Convert display currency amount back to base (INR) for storage
  const convertToBase = (amount: number): number => {
      const rate = exchangeRates[currency] || CURRENCIES[currency].rate || 1;
      return amount / rate;
  }

  // Local Storage Fallback Helper
  const saveToLocal = (key: string, data: any) => {
      if (!user) return;
      try {
        localStorage.setItem(`${key}_${user.uid}`, JSON.stringify(data));
      } catch (e) { console.error("Local storage save error", e); }
  };

  const loadFromLocal = (key: string) => {
      if (!user) return null;
      try {
        const data = localStorage.getItem(`${key}_${user.uid}`);
        return data ? JSON.parse(data) : null;
      } catch (e) { return null; }
  };

  // Initialize User Profile in Firestore & Fetch Last Login
  useEffect(() => {
    const initUserProfile = async () => {
      if (user && isOnline && isBackendReady) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: user.email,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              platform: navigator.platform
            }, { merge: true });
            setLastLoginTime(new Date());
          } else {
             const data = userSnap.data();
             if (data.lastLogin) {
                 setLastLoginTime(data.lastLogin.toDate());
             }
             // Update last login
             await updateDoc(userRef, {
                 lastLogin: serverTimestamp()
             });
          }
        } catch (e: any) {
          console.error("Failed to initialize user profile on backend:", e);
          if (e.code === 'permission-denied') {
             console.warn("Permission denied. Check Firestore Security Rules.");
          }
        }
      }
    };
    initUserProfile();
  }, [user, isOnline, isBackendReady]);

  // Sync Transactions
  useEffect(() => {
    if (!user) {
        setTransactions([]);
        return;
    }

    if (!isBackendReady) {
        const localData = loadFromLocal('transactions');
        if (localData) setTransactions(localData);
        return;
    }

    let unsubscribe = () => {};

    try {
        // Optimized Query: Sort by date descending in database
        const q = query(collection(db, `users/${user.uid}/transactions`), orderBy('date', 'desc'));
        unsubscribe = onSnapshot(q, (snapshot) => {
            const txData: Transaction[] = [];
            snapshot.forEach((doc) => {
                txData.push(doc.data() as Transaction);
            });
            // Sorting is now handled by the database
            setTransactions(txData);
            saveToLocal('transactions', txData);
        }, (error) => {
            console.warn("Firestore access failed (possibly missing DB), switching to local-only mode:", error.message);
            setIsBackendReady(false);
            const localData = loadFromLocal('transactions');
            if (localData) setTransactions(localData);
        });
    } catch (e) {
        console.warn("Firestore setup error:", e);
        setIsBackendReady(false);
        const localData = loadFromLocal('transactions');
        if (localData) setTransactions(localData);
    }

    return () => unsubscribe();
  }, [user, isBackendReady]);

  // Sync Settings (Currency, Rules, Limits, MFA)
  useEffect(() => {
      if (!user || !isBackendReady) {
          if (!user) {
              setCurrencyState('INR');
              setIgnoreRules(DEFAULT_RULES);
              setDailyLimitState(0);
              setMfaEnabledState(false);
              setOpeningBalanceState(0);
          } else {
               const localCurrency = loadFromLocal('currency');
               if (localCurrency) setCurrencyState(localCurrency);
               
               const localRules = loadFromLocal('ignoreRules');
               if (localRules) setIgnoreRules(localRules);
               else setIgnoreRules(DEFAULT_RULES);

               const localLimit = loadFromLocal('dailyLimit');
               if (localLimit) setDailyLimitState(localLimit);
               
               const localMfa = loadFromLocal('mfaEnabled');
               if (localMfa !== null) setMfaEnabledState(localMfa);
               
               const localOpeningBalance = loadFromLocal('openingBalance');
               if (localOpeningBalance !== null) setOpeningBalanceState(localOpeningBalance || 0);
          }
          return;
      }

      let unsubscribe = () => {};

      try {
          const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
          unsubscribe = onSnapshot(settingsRef, (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data.currency) {
                      setCurrencyState(data.currency);
                      saveToLocal('currency', data.currency);
                  }
                  if (data.ignoreRules) {
                      setIgnoreRules(data.ignoreRules);
                      saveToLocal('ignoreRules', data.ignoreRules);
                  }
                  if (data.dailyLimit !== undefined) {
                      setDailyLimitState(data.dailyLimit);
                      saveToLocal('dailyLimit', data.dailyLimit);
                  }
                  if (data.mfaEnabled !== undefined) {
                      setMfaEnabledState(data.mfaEnabled);
                      saveToLocal('mfaEnabled', data.mfaEnabled);
                  }
                  if (data.openingBalance !== undefined) {
                      setOpeningBalanceState(data.openingBalance || 0);
                      saveToLocal('openingBalance', data.openingBalance || 0);
                  }
              } else {
                  if (isOnline) {
                    setDoc(settingsRef, { 
                        currency: 'INR', 
                        ignoreRules: DEFAULT_RULES,
                        dailyLimit: 0,
                        mfaEnabled: false
                    }, { merge: true })
                    .catch(err => console.warn("Failed to init settings on backend", err));
                  }
              }
          }, (error) => {
              const localCurrency = loadFromLocal('currency');
              if (localCurrency) setCurrencyState(localCurrency);
              
              const localRules = loadFromLocal('ignoreRules');
              if (localRules) setIgnoreRules(localRules);
              else setIgnoreRules(DEFAULT_RULES);
              
              const localOpeningBalance = loadFromLocal('openingBalance');
              if (localOpeningBalance !== null) setOpeningBalanceState(localOpeningBalance || 0);
          });
      } catch (e) {
           const localCurrency = loadFromLocal('currency');
           if (localCurrency) setCurrencyState(localCurrency);
           
           const localRules = loadFromLocal('ignoreRules');
           if (localRules) setIgnoreRules(localRules);
           else setIgnoreRules(DEFAULT_RULES);
           
           const localOpeningBalance = loadFromLocal('openingBalance');
           if (localOpeningBalance !== null) setOpeningBalanceState(localOpeningBalance || 0);
      }

      return () => unsubscribe();
  }, [user, isBackendReady]);

  const retryCloudConnection = () => {
      setIsBackendReady(true);
  };

  const setCurrency = async (code: CurrencyCode) => {
    setCurrencyState(code);
    saveToLocal('currency', code);
    if (user && isOnline && isBackendReady) {
        try {
            const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
            await setDoc(settingsRef, { currency: code }, { merge: true });
        } catch (e) { console.warn("Backend update failed, using local state"); }
    }
  };

  const setDailyLimit = async (limit: number) => {
      setDailyLimitState(limit);
      saveToLocal('dailyLimit', limit);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { dailyLimit: limit }, { merge: true });
          } catch (e) { console.warn("Backend update failed", e); }
      }
  };

  const setMfaEnabled = async (enabled: boolean) => {
      setMfaEnabledState(enabled);
      saveToLocal('mfaEnabled', enabled);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { mfaEnabled: enabled }, { merge: true });
          } catch (e) { console.warn("Backend update failed", e); }
      }
  };

  const setOpeningBalance = async (balance: number) => {
      setOpeningBalanceState(balance);
      saveToLocal('openingBalance', balance);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { openingBalance: balance }, { merge: true });
          } catch (e) { console.warn("Backend update failed", e); }
      }
  };

  const addTransaction = async (transaction: Transaction): Promise<boolean> => {
    // Check Daily Limit
    if (transaction.type === TransactionType.EXPENSE && dailyLimit > 0) {
        const today = new Date().toDateString();
        const todaySpend = transactions
            .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).toDateString() === today)
            .reduce((acc, t) => acc + t.amount, 0);
        
        if (todaySpend + transaction.amount > dailyLimit) {
            alert(`Transaction declined. Exceeds daily limit of ${formatAmount(dailyLimit)}.`);
            return false;
        }
    }

    const newTxs = [transaction, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(newTxs);
    saveToLocal('transactions', newTxs);
    
    if (user && isBackendReady) {
        const txRef = doc(db, `users/${user.uid}/transactions/${transaction.id}`);
        setDoc(txRef, transaction)
            .then(() => console.log("Transaction saved to Firestore"))
            .catch(e => {
                console.warn("Backend update queued/failed", e);
                if (e.message.includes('not-found') || e.code === 'permission-denied') setIsBackendReady(false);
            });
    }
    return true;
  };

  const editTransaction = async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) {
        console.error('Transaction not found');
        return false;
      }

      const updatedTx = { ...transaction, ...updates, id: transaction.id };
      const newTxs = transactions.map(t => t.id === id ? updatedTx : t);
      setTransactions(newTxs);
      saveToLocal('transactions', newTxs);

      if (user && isBackendReady) {
        const txRef = doc(db, `users/${user.uid}/transactions/${id}`);
        await updateDoc(txRef, updates)
          .catch(e => {
            console.warn('Backend update queued/failed', e);
            if (e.message.includes('not-found') || e.code === 'permission-denied') setIsBackendReady(false);
          });
      }
      return true;
    } catch (error) {
      console.error('Edit transaction error:', error);
      return false;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      const newTxs = transactions.filter(t => t.id !== id);
      setTransactions(newTxs);
      saveToLocal('transactions', newTxs);
      
      if (user && isBackendReady) {
        deleteDoc(doc(db, `users/${user.uid}/transactions/${id}`)).catch(e => console.warn('Backend delete queued/failed', e));
      }
    } catch (error) {
      console.error('Delete transaction error:', error);
    }
  };

  const clearAllTransactions = async () => {
    setTransactions([]);
    saveToLocal('transactions', []);
    setOpeningBalanceState(0);
    saveToLocal('openingBalance', 0);

    if (user && isBackendReady) {
        try {
            const q = query(collection(db, `users/${user.uid}/transactions`));
            const snapshot = await getDocs(q);
            const docs = snapshot.docs;
            
            // Process in chunks of 500 (Firestore Batch Limit)
            const chunkArray = (arr: any[], size: number) => {
                const results = [];
                for (let i = 0; i < arr.length; i += size) {
                    results.push(arr.slice(i, i + size));
                }
                return results;
            };

            const chunks = chunkArray(docs, 500);

            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
            }
            console.log("All transactions cleared from backend");
        } catch (e) {
            console.warn("Failed to clear backend transactions", e);
        }
    }
  };

  const importTransactions = async (newTransactions: Transaction[]) => {
    console.log('importTransactions called with:', newTransactions.length, 'transactions');
    console.log('Sample import data:', newTransactions.slice(0, 2));
    
    const existingIds = new Set(transactions.map(t => t.id));
    const uniqueNew = newTransactions.filter(t => !existingIds.has(t.id));

    console.log('Unique new transactions:', uniqueNew.length);

    if (uniqueNew.length === 0) {
        console.warn('No new unique transactions to import');
        return;
    }

    const combined = [...uniqueNew, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(combined);
    saveToLocal('transactions', combined);
    
    console.log('Transactions updated. Total count:', combined.length);
    
    if (user && isBackendReady) {
        try {
            // Chunk imports
             const chunkArray = (arr: any[], size: number) => {
                const results = [];
                for (let i = 0; i < arr.length; i += size) {
                    results.push(arr.slice(i, i + size));
                }
                return results;
            };

            const chunks = chunkArray(uniqueNew, 500);
            
            for (const chunk of chunks) {
                 const batch = writeBatch(db);
                 chunk.forEach(tx => {
                    const ref = doc(db, `users/${user.uid}/transactions/${tx.id}`);
                    batch.set(ref, tx);
                 });
                 await batch.commit();
            }
            console.log(`Imported ${uniqueNew.length} transactions via batch write to Firestore.`);
        } catch (e) {
            console.warn("Batch import failed", e);
        }
    } else {
        console.log('Firestore not ready, transactions saved to localStorage only');
    }
  };

  const toggleIgnoreRule = async (id: string) => {
    const newRules = ignoreRules.map(rule => 
      rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
    );
    setIgnoreRules(newRules);
    saveToLocal('ignoreRules', newRules);
    
    if (user && isOnline && isBackendReady) {
        try {
            const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
            await updateDoc(settingsRef, { ignoreRules: newRules });
        } catch (e) { console.warn("Backend update failed, using local state"); }
    }
  };

  const getBalance = () => {
    const transactionBalance = transactions.reduce((acc, curr) => {
      return curr.type === TransactionType.INCOME ? acc + curr.amount : acc - curr.amount;
    }, 0);
    return openingBalance + transactionBalance;
  };

  const getMonthlyIncome = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyIncome = transactions
      .filter(t => {
        if (t.type !== TransactionType.INCOME) return false;
        const txDate = new Date(t.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    return monthlyIncome;
  };

  const getMonthlyExpense = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyExpense = transactions
      .filter(t => {
        if (t.type !== TransactionType.EXPENSE) return false;
        const txDate = new Date(t.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    return monthlyExpense;
  };

  const getTotalIncome = () => {
    return transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  const getTotalExpense = () => {
    return transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, curr) => acc + curr.amount, 0);
  };

  return (
    <WalletContext.Provider value={{
      transactions,
      currency,
      ignoreRules,
      dailyLimit,
      mfaEnabled,
      isOnline,
      isCloudSyncing: isOnline && isBackendReady,
      setCurrency,
      setDailyLimit,
      setMfaEnabled,
      setOpeningBalance,
      addTransaction,
      editTransaction,
      deleteTransaction,
      clearAllTransactions,
      importTransactions,
      toggleIgnoreRule,
      openingBalance,
      getBalance,
      getMonthlyIncome,
      getMonthlyExpense,
      getTotalIncome,
      getTotalExpense,
      formatAmount,
      convertToBase,
      retryCloudConnection,
      lastLoginTime
    }}>
      {children}
    </WalletContext.Provider>
  );
};