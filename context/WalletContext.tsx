import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { Transaction, TransactionType, CurrencyCode, IgnoreRule } from '../types';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, serverTimestamp, writeBatch, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { CURRENCIES, getCurrencyFormatter, getCompactCurrencyFormatter } from '../currencyUtils';
import { log } from '../utils/log';

interface WalletContextType {
  transactions: Transaction[];
  currency: CurrencyCode;
  ignoreRules: IgnoreRule[];
  dailyLimit: number;
  mfaEnabled: boolean;
  isOnline: boolean;
  isCloudSyncing: boolean;
  openingBalance: number;
  /** ISO date the opening balance is anchored to (start of the earliest imported statement). */
  openingBalanceAsOf: string | null;
  setCurrency: (code: CurrencyCode) => void;
  setDailyLimit: (limit: number) => void;
  setMfaEnabled: (enabled: boolean) => void;
  setOpeningBalance: (balance: number, asOf?: string | null) => void;
  addTransaction: (transaction: Transaction) => Promise<boolean>;
  editTransaction: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => void;
  clearAllTransactions: () => Promise<void>;
  importTransactions: (newTransactions: Transaction[], openingBalance?: number, statementStart?: string) => void;
  toggleIgnoreRule: (id: string) => void;
  getBalance: () => number;
  getMonthlyIncome: () => number;
  getMonthlyExpense: () => number;
  getDailyIncome: () => number;
  getDailyExpense: () => number;
  getTotalIncome: () => number;
  getTotalExpense: () => number;
  formatAmount: (amountInBase: number) => string;
  formatAmountCompact: (amountInBase: number) => string;
  convertToBase: (amount: number) => number;
  retryCloudConnection: () => void;
  /** Force re-subscribe of cloud listeners — the manual "pull to refresh". */
  refresh: () => void;
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

// Only these currencies are selectable in the UI; don't keep ~160 rates in state.
const SUPPORTED_CODES: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP'];
const FX_CACHE_KEY = 'fxRates_v1';
const FX_TTL_MS = 60 * 60 * 1000; // 1 hour

const FALLBACK_RATES: Record<string, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
};

const readFxCache = (): { rates: Record<string, number>; fetchedAt: number } | null => {
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.fetchedAt === 'number' && parsed.rates) return parsed;
    return null;
  } catch {
    return null;
  }
};

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const results: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    results.push(arr.slice(i, i + size));
  }
  return results;
};

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currency, setCurrencyState] = useState<CurrencyCode>('INR');
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([]);
  const [dailyLimit, setDailyLimitState] = useState<number>(0);
  const [mfaEnabled, setMfaEnabledState] = useState<boolean>(false);
  const [lastLoginTime, setLastLoginTime] = useState<Date | null>(null);
  const [openingBalance, setOpeningBalanceState] = useState<number>(0);
  const [openingBalanceAsOf, setOpeningBalanceAsOfState] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Backend ready state to handle cases where DB doesn't exist
  const [isBackendReady, setIsBackendReady] = useState(true);
  // Bumped by refresh() — re-runs the listener effects for a fresh server pull.
  const [refreshNonce, setRefreshNonce] = useState(0);
  // While a Clear All is running, snapshot echoes of the soon-to-be-deleted
  // docs must not repopulate state (issue: cleared data "flickering back").
  const clearingRef = useRef(false);

  // Exchange Rates State (Base: INR). Hydrate from the local cache when fresh.
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(() => {
    const cached = readFxCache();
    return cached ? { ...FALLBACK_RATES, ...cached.rates } : FALLBACK_RATES;
  });

  // Refs that let long-lived listeners read current values without re-subscribing.
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;
  const isBackendReadyRef = useRef(isBackendReady);
  isBackendReadyRef.current = isBackendReady;

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

  // Fetch Live Rates — only when the cache is stale (audit Phase 3.2)
  useEffect(() => {
    const fetchRates = async (force = false) => {
        if (!isOnlineRef.current) return;
        if (!force) {
            const cached = readFxCache();
            if (cached && Date.now() - cached.fetchedAt < FX_TTL_MS) return; // still fresh
        }
        try {
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/INR');
            if (res.ok) {
                const data = await res.json();
                // Keep only the currencies the app supports.
                const rates: Record<string, number> = {};
                for (const code of SUPPORTED_CODES) {
                    if (typeof data?.rates?.[code] === 'number') rates[code] = data.rates[code];
                }
                if (Object.keys(rates).length > 0) {
                    setExchangeRates(prev => ({ ...prev, ...rates }));
                    try {
                        localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates, fetchedAt: Date.now() }));
                    } catch { /* storage full — non-fatal */ }
                }
            }
        } catch (e) {
            log.warn('FX rate fetch failed, using cached/fallback rates');
        }
    };

    fetchRates();
    const interval = setInterval(() => fetchRates(), FX_TTL_MS);
    return () => clearInterval(interval);
  }, [isOnline]);

  // Helper: Format Amount based on active currency and live rate.
  // Uses a cached Intl.NumberFormat (audit Phase 2.2).
  const formatAmount = useCallback((amountInBase: number): string => {
      const rate = exchangeRates[currency] || CURRENCIES[currency].rate || 1;
      return getCurrencyFormatter(currency).format(amountInBase * rate);
  }, [currency, exchangeRates]);

  // Short form for chart axes: ₹85.7K instead of ₹85,707.00
  const formatAmountCompact = useCallback((amountInBase: number): string => {
      const rate = exchangeRates[currency] || CURRENCIES[currency].rate || 1;
      return getCompactCurrencyFormatter(currency).format(amountInBase * rate);
  }, [currency, exchangeRates]);

  // Helper: Convert display currency amount back to base (INR) for storage
  const convertToBase = useCallback((amount: number): number => {
      const rate = exchangeRates[currency] || CURRENCIES[currency].rate || 1;
      return amount / rate;
  }, [currency, exchangeRates]);

  // Local Storage Fallback Helpers
  const saveToLocal = useCallback((key: string, data: any) => {
      if (!user) return;
      try {
        localStorage.setItem(`${key}_${user.uid}`, JSON.stringify(data));
      } catch (e) { log.error('Local storage save error'); }
  }, [user]);

  const loadFromLocal = useCallback((key: string) => {
      if (!user) return null;
      try {
        const data = localStorage.getItem(`${key}_${user.uid}`);
        return data ? JSON.parse(data) : null;
      } catch (e) { return null; }
  }, [user]);

  // Debounced transaction mirror (audit Phase 3.1).
  // Firestore's persistent cache already covers offline reads; this mirror only
  // exists as a fallback for backend-unavailable (rules/missing DB) mode, so a
  // trailing 1s write is plenty — and avoids serializing the whole list on
  // every change.
  const mirrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleMirror = useCallback((txs: Transaction[]) => {
      if (mirrorTimer.current) clearTimeout(mirrorTimer.current);
      mirrorTimer.current = setTimeout(() => saveToLocal('transactions', txs), 1000);
  }, [saveToLocal]);
  useEffect(() => () => { if (mirrorTimer.current) clearTimeout(mirrorTimer.current); }, []);

  // Persist transactions: immediate when running local-only, debounced otherwise.
  const persistTransactions = useCallback((txs: Transaction[]) => {
      if (isBackendReadyRef.current) scheduleMirror(txs);
      else saveToLocal('transactions', txs);
  }, [scheduleMirror, saveToLocal]);

  // Initialize User Profile in Firestore & Fetch Last Login (audit Phase 3.3:
  // single merged write, fire-and-forget; read kept only for the
  // "previous login" display).
  useEffect(() => {
    const initUserProfile = async () => {
      if (!user || !isBackendReady) return;
      const userRef = doc(db, 'users', user.uid);
      let isNewUser = false;
      try {
        const userSnap = await getDoc(userRef);
        isNewUser = !userSnap.exists();
        if (!isNewUser && userSnap.data()?.lastLogin) {
          setLastLoginTime(userSnap.data()!.lastLogin.toDate());
        } else {
          setLastLoginTime(new Date());
        }
      } catch {
        // Offline at startup — Firestore cache may not have the doc yet; non-fatal.
      }
      setDoc(userRef, {
        email: user.email,
        lastLogin: serverTimestamp(),
        platform: navigator.platform,
        ...(isNewUser ? { createdAt: serverTimestamp() } : {})
      }, { merge: true }).catch((e: any) => {
        log.warn('Failed to update user profile:', e?.code || 'unknown');
        if (e?.code === 'permission-denied') {
          log.warn('Permission denied. Check Firestore Security Rules.');
        }
      });
    };
    initUserProfile();
  }, [user, isBackendReady]);

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
        // Sorted by date descending in the database
        const q = query(collection(db, `users/${user.uid}/transactions`), orderBy('date', 'desc'));
        unsubscribe = onSnapshot(q, (snapshot) => {
            // Ignore echoes while Clear All is deleting in batches — otherwise
            // half-deleted snapshots repopulate the UI mid-clear.
            if (clearingRef.current) return;
            const txData: Transaction[] = [];
            snapshot.forEach((d) => {
                txData.push(d.data() as Transaction);
            });
            setTransactions(txData);
            scheduleMirror(txData);
        }, (error) => {
            log.warn('Firestore access failed, switching to local-only mode:', error.message);
            setIsBackendReady(false);
            // Keep whatever is already in memory (freshest); only fall back to
            // the mirror when we have nothing.
            setTransactions(prev => {
                if (prev.length > 0) return prev;
                const localData = loadFromLocal('transactions');
                return localData ?? prev;
            });
        });
    } catch (e) {
        log.warn('Firestore setup error:', e);
        setIsBackendReady(false);
        const localData = loadFromLocal('transactions');
        if (localData) setTransactions(localData);
    }

    return () => unsubscribe();
  }, [user, isBackendReady, refreshNonce, loadFromLocal, scheduleMirror]);

  // Sync Settings (Currency, Rules, Limits, MFA, Opening Balance)
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
               if (localOpeningBalance !== null) {
                   setOpeningBalanceState(localOpeningBalance || 0);
               }
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
                  if (data.openingBalanceAsOf !== undefined) {
                      setOpeningBalanceAsOfState(data.openingBalanceAsOf || null);
                      saveToLocal('openingBalanceAsOf', data.openingBalanceAsOf || null);
                  }
              } else if (isOnlineRef.current) {
                  setDoc(settingsRef, {
                      currency: 'INR',
                      ignoreRules: DEFAULT_RULES,
                      dailyLimit: 0,
                      mfaEnabled: false
                  }, { merge: true })
                  .catch(() => log.warn('Failed to init settings on backend'));
              }
          }, (error) => {
              log.warn('Settings listener error, falling back to localStorage:', error.message);
              const localCurrency = loadFromLocal('currency');
              if (localCurrency) setCurrencyState(localCurrency);

              const localRules = loadFromLocal('ignoreRules');
              if (localRules) setIgnoreRules(localRules);
              else setIgnoreRules(DEFAULT_RULES);

              const localOpeningBalance = loadFromLocal('openingBalance');
              if (localOpeningBalance !== null) {
                  setOpeningBalanceState(localOpeningBalance || 0);
              }
          });
      } catch (e) {
           log.warn('Settings sync exception, falling back to localStorage');
           const localCurrency = loadFromLocal('currency');
           if (localCurrency) setCurrencyState(localCurrency);

           const localRules = loadFromLocal('ignoreRules');
           if (localRules) setIgnoreRules(localRules);
           else setIgnoreRules(DEFAULT_RULES);

           const localOpeningBalance = loadFromLocal('openingBalance');
           if (localOpeningBalance !== null) {
               setOpeningBalanceState(localOpeningBalance || 0);
           }
      }

      return () => unsubscribe();
  }, [user, isBackendReady, refreshNonce, loadFromLocal, saveToLocal]);

  const retryCloudConnection = useCallback(() => {
      setIsBackendReady(true);
  }, []);

  // Manual refresh: re-arm backend mode and force both listeners to
  // re-subscribe (fresh server snapshot). Safe to spam.
  const refresh = useCallback(() => {
      setIsBackendReady(true);
      setRefreshNonce(n => n + 1);
  }, []);

  const setCurrency = useCallback(async (code: CurrencyCode) => {
    setCurrencyState(code);
    saveToLocal('currency', code);
    if (user && isOnline && isBackendReady) {
        try {
            const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
            await setDoc(settingsRef, { currency: code }, { merge: true });
        } catch (e) { log.warn('Backend update failed, using local state'); }
    }
  }, [user, isOnline, isBackendReady, saveToLocal]);

  const setDailyLimit = useCallback(async (limit: number) => {
      setDailyLimitState(limit);
      saveToLocal('dailyLimit', limit);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { dailyLimit: limit }, { merge: true });
          } catch (e) { log.warn('Backend update failed'); }
      }
  }, [user, isOnline, isBackendReady, saveToLocal]);

  const setMfaEnabled = useCallback(async (enabled: boolean) => {
      setMfaEnabledState(enabled);
      saveToLocal('mfaEnabled', enabled);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { mfaEnabled: enabled }, { merge: true });
          } catch (e) { log.warn('Backend update failed'); }
      }
  }, [user, isOnline, isBackendReady, saveToLocal]);

  const setOpeningBalance = useCallback(async (balance: number, asOf: string | null = null) => {
      setOpeningBalanceState(balance);
      setOpeningBalanceAsOfState(asOf);
      saveToLocal('openingBalance', balance);
      saveToLocal('openingBalanceAsOf', asOf);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { openingBalance: balance, openingBalanceAsOf: asOf }, { merge: true });
          } catch (e) {
              log.warn('Backend update failed for opening balance');
          }
      }
  }, [user, isOnline, isBackendReady, saveToLocal]);

  // ── Aggregates ────────────────────────────────────────────────────────────
  // Single pass over transactions, recomputed only when data changes
  // (audit Phase 2.3). Each transaction's date is parsed exactly once here.
  const aggregates = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dayKey = now.toDateString();

    let totalIncome = 0, totalExpense = 0;
    let monthlyIncome = 0, monthlyExpense = 0;
    let todayIncome = 0, todayExpense = 0;

    for (const t of transactions) {
      const isIncome = t.type === TransactionType.INCOME;
      if (isIncome) totalIncome += t.amount; else totalExpense += t.amount;

      const d = new Date(t.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (isIncome) monthlyIncome += t.amount; else monthlyExpense += t.amount;
      }
      if (d.toDateString() === dayKey) {
        if (isIncome) todayIncome += t.amount; else todayExpense += t.amount;
      }
    }

    return {
      dayKey,
      totalIncome,
      totalExpense,
      monthlyIncome,
      monthlyExpense,
      todayIncome,
      todayExpense,
      balance: openingBalance + totalIncome - totalExpense,
    };
  }, [transactions, openingBalance]);

  const getBalance = useCallback(() => aggregates.balance, [aggregates]);
  const getMonthlyIncome = useCallback(() => aggregates.monthlyIncome, [aggregates]);
  const getMonthlyExpense = useCallback(() => aggregates.monthlyExpense, [aggregates]);
  const getDailyIncome = useCallback(() => aggregates.todayIncome, [aggregates]);
  const getDailyExpense = useCallback(() => aggregates.todayExpense, [aggregates]);
  const getTotalIncome = useCallback(() => aggregates.totalIncome, [aggregates]);
  const getTotalExpense = useCallback(() => aggregates.totalExpense, [aggregates]);

  const addTransaction = useCallback(async (transaction: Transaction): Promise<boolean> => {
    // Check Daily Limit (audit Phase 2.8: reuse the aggregate when it is for
    // today; recompute only across a midnight boundary).
    if (transaction.type === TransactionType.EXPENSE && dailyLimit > 0) {
        const today = new Date().toDateString();
        const todaySpend = aggregates.dayKey === today
            ? aggregates.todayExpense
            : transactions
                .filter(t => t.type === TransactionType.EXPENSE && new Date(t.date).toDateString() === today)
                .reduce((acc, t) => acc + t.amount, 0);

        if (todaySpend + transaction.amount > dailyLimit) {
            alert(`Transaction declined. Exceeds daily limit of ${formatAmount(dailyLimit)}.`);
            return false;
        }
    }

    const newTxs = [transaction, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(newTxs);
    persistTransactions(newTxs);

    if (user && isBackendReady) {
        const txRef = doc(db, `users/${user.uid}/transactions/${transaction.id}`);
        setDoc(txRef, transaction)
            .catch(e => {
                log.warn('Backend write queued/failed:', e?.code || e?.message);
                if (e.message?.includes('not-found') || e.code === 'permission-denied') setIsBackendReady(false);
            });
    }
    return true;
  }, [transactions, dailyLimit, aggregates, formatAmount, persistTransactions, user, isBackendReady]);

  const editTransaction = useCallback(async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) {
        log.error('Edit failed: transaction not found');
        return false;
      }

      const updatedTx = { ...transaction, ...updates, id: transaction.id };
      const newTxs = transactions.map(t => t.id === id ? updatedTx : t);
      setTransactions(newTxs);
      persistTransactions(newTxs);

      if (user && isBackendReady) {
        const txRef = doc(db, `users/${user.uid}/transactions/${id}`);
        await updateDoc(txRef, updates)
          .catch(e => {
            log.warn('Backend update queued/failed:', e?.code || e?.message);
            if (e.message?.includes('not-found') || e.code === 'permission-denied') setIsBackendReady(false);
          });
      }
      return true;
    } catch (error) {
      log.error('Edit transaction error');
      return false;
    }
  }, [transactions, persistTransactions, user, isBackendReady]);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const newTxs = transactions.filter(t => t.id !== id);
      setTransactions(newTxs);
      persistTransactions(newTxs);

      if (user && isBackendReady) {
        deleteDoc(doc(db, `users/${user.uid}/transactions/${id}`)).catch(e => log.warn('Backend delete queued/failed:', e?.code));
      }
    } catch (error) {
      log.error('Delete transaction error');
    }
  }, [transactions, persistTransactions, user, isBackendReady]);

  const clearAllTransactions = useCallback(async () => {
    clearingRef.current = true;
    setTransactions([]);
    saveToLocal('transactions', []);
    setOpeningBalanceState(0);
    setOpeningBalanceAsOfState(null);
    saveToLocal('openingBalance', 0);
    saveToLocal('openingBalanceAsOf', null);

    try {
        if (user && isBackendReady) {
            // Also reset the cloud opening balance, otherwise the settings
            // snapshot restores the old value after a clear (audit Phase 1.2).
            const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
            setDoc(settingsRef, { openingBalance: 0, openingBalanceAsOf: null }, { merge: true })
                .catch(() => log.warn('Failed to reset opening balance on backend'));

            const q = query(collection(db, `users/${user.uid}/transactions`));
            const snapshot = await getDocs(q);
            const chunks = chunkArray(snapshot.docs, 500); // Firestore batch limit

            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(d => {
                    batch.delete(d.ref);
                });
                await batch.commit();
            }
        }
    } catch (e) {
        log.warn('Failed to clear backend transactions');
    } finally {
        // Snapshot listener resumes only after every batch is committed.
        clearingRef.current = false;
    }
  }, [user, isBackendReady, saveToLocal]);

  const importTransactions = useCallback(async (newTransactions: Transaction[], importedOpeningBalance?: number, statementStart?: string) => {
    const existingIds = new Set(transactions.map(t => t.id));
    const uniqueNew = newTransactions.filter(t => !existingIds.has(t.id));

    if (uniqueNew.length === 0) {
        log.warn('No new unique transactions to import');
        return;
    }

    // Anchor the opening balance to the EARLIEST statement we've ever seen,
    // so Balance = opening + Σ(all txns) always tallies even when statements
    // are imported out of order (issue: imported balance not matching).
    if (importedOpeningBalance !== undefined) {
        let shouldApply = false;
        if (transactions.length === 0) {
            shouldApply = true;
        } else if (openingBalanceAsOf) {
            // Older statement than the current anchor → its opening wins.
            shouldApply = !!statementStart && statementStart < openingBalanceAsOf;
        } else if (statementStart) {
            // Legacy data without an anchor: apply only if this statement
            // starts at/before everything already in the wallet.
            const earliest = transactions.reduce((m, t) => (t.date < m ? t.date : m), transactions[0].date);
            shouldApply = statementStart <= earliest;
        }
        if (shouldApply) {
            await setOpeningBalance(importedOpeningBalance, statementStart ?? null);
        }
    }

    const combined = [...uniqueNew, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setTransactions(combined);
    persistTransactions(combined);

    if (user && isBackendReady) {
        try {
            const chunks = chunkArray(uniqueNew, 500);
            for (const chunk of chunks) {
                 const batch = writeBatch(db);
                 chunk.forEach(tx => {
                    const ref = doc(db, `users/${user.uid}/transactions/${tx.id}`);
                    batch.set(ref, tx);
                 });
                 await batch.commit();
            }
            log.debug(`Imported ${uniqueNew.length} transactions via batch write`);
        } catch (e) {
            log.warn('Firestore import failed');
        }
    }
  }, [transactions, openingBalanceAsOf, setOpeningBalance, persistTransactions, user, isBackendReady]);

  const toggleIgnoreRule = useCallback(async (id: string) => {
    const newRules = ignoreRules.map(rule =>
      rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
    );
    setIgnoreRules(newRules);
    saveToLocal('ignoreRules', newRules);

    if (user && isOnline && isBackendReady) {
        try {
            const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
            await updateDoc(settingsRef, { ignoreRules: newRules });
        } catch (e) { log.warn('Backend update failed, using local state'); }
    }
  }, [ignoreRules, user, isOnline, isBackendReady, saveToLocal]);

  // Memoized provider value (audit Phase 2.1) — consumers no longer re-render
  // from identity churn alone.
  const value = useMemo<WalletContextType>(() => ({
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
      openingBalanceAsOf,
      getBalance,
      getMonthlyIncome,
      getMonthlyExpense,
      getDailyIncome,
      getDailyExpense,
      getTotalIncome,
      getTotalExpense,
      formatAmount,
      formatAmountCompact,
      convertToBase,
      retryCloudConnection,
      refresh,
      lastLoginTime
  }), [
      transactions, currency, ignoreRules, dailyLimit, mfaEnabled, isOnline,
      isBackendReady, openingBalance, openingBalanceAsOf, setCurrency, setDailyLimit, setMfaEnabled,
      setOpeningBalance, addTransaction, editTransaction, deleteTransaction,
      clearAllTransactions, importTransactions, toggleIgnoreRule, getBalance,
      getMonthlyIncome, getMonthlyExpense, getDailyIncome, getDailyExpense,
      getTotalIncome, getTotalExpense, formatAmount, formatAmountCompact,
      convertToBase, retryCloudConnection, refresh, lastLoginTime
  ]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
