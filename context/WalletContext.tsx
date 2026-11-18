import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { Transaction, TransactionType, CurrencyCode, PayeeKind, PayeeRule, canonicalCategory } from '../types';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc, serverTimestamp, writeBatch, getDocs, orderBy, DocumentReference } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { CURRENCIES, getCurrencyFormatter, getCompactCurrencyFormatter } from '../utils/currencyUtils';
import { byNewest, fromTimestamp, isDay, localDay } from '../utils/dates';
import { FlowInfo, flowClassifier, matchText, MIN_MATCH } from '../services/spend';
import { log } from '../utils/log';

// Category names from earlier versions (audit M10) are mapped once, as data
// loads, so every screen, the Edit dialog and budgets see one name each.
const withListCategories = (list: Transaction[]): Transaction[] =>
  list.map(t => {
    if (!t.category) return t;
    const category = canonicalCategory(t.category, t.type);
    return category === t.category ? t : { ...t, category };
  });

// The day and time to store for an entry an earlier version saved as a UTC
// timestamp (audit H4), or null when its date is already a local day.
const localDayFields = (t: Transaction): { date: string; createdAt?: string } | null => {
  const fixed = fromTimestamp(t.date);
  if (!fixed) return null;
  return t.createdAt || !fixed.createdAt ? { date: fixed.date } : fixed;
};

// Everything that loads passes through here, so every screen sees list
// category names and local days, newest first.
const asLoaded = (list: Transaction[]): Transaction[] =>
  withListCategories(list)
    .map(t => {
      const fields = localDayFields(t);
      return fields ? { ...t, ...fields } : t;
    })
    .sort(byNewest);

const PAYEE_KINDS = new Set<PayeeKind>(['mine', 'family', 'investment', 'ignore', 'counts', 'salary']);

// Payee rules as saved (Firestore or this device); anything malformed is dropped.
const asPayeeRules = (raw: unknown): PayeeRule[] =>
  Array.isArray(raw)
    ? raw.filter((r): r is PayeeRule =>
        !!r && typeof r.id === 'string' && typeof r.match === 'string' &&
        matchText(r.match).length >= MIN_MATCH && PAYEE_KINDS.has(r.kind))
    : [];

// A budget saved under a list name wins; budgets kept only under old names
// (Phone and Internet, say) are added together under the list name.
const withListBudgetNames = (budgets: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  const fromOldNames: Record<string, number> = {};
  for (const [category, amount] of Object.entries(budgets)) {
    const name = canonicalCategory(category, TransactionType.EXPENSE);
    if (name === category) out[name] = amount;
    else fromOldNames[name] = (fromOldNames[name] ?? 0) + amount;
  }
  for (const [name, amount] of Object.entries(fromOldNames)) {
    if (!(name in out)) out[name] = amount;
  }
  return out;
};

interface WalletContextType {
  transactions: Transaction[];
  currency: CurrencyCode;
  /** Payee rules from the Money Moved screen (audit H3, M9). */
  payeeRules: PayeeRule[];
  /** How a transaction counts: spending, income or money moved (never two). */
  flowOf: (t: Transaction) => FlowInfo;
  /** The transactions that count as spending or income; money moved is left out. */
  counted: Transaction[];
  dailyLimit: number;
  mfaEnabled: boolean;
  /** Per-category monthly budgets (INR base). */
  budgets: Record<string, number>;
  /** Monthly savings target (INR base, 0 = unset). */
  savingsGoal: number;
  isOnline: boolean;
  isCloudSyncing: boolean;
  openingBalance: number;
  /** ISO date the opening balance is anchored to (start of the earliest imported statement). */
  openingBalanceAsOf: string | null;
  setCurrency: (code: CurrencyCode) => void;
  setDailyLimit: (limit: number) => void;
  setMfaEnabled: (enabled: boolean) => void;
  setBudget: (category: string, amount: number) => void;
  setSavingsGoal: (amount: number) => void;
  setOpeningBalance: (balance: number, asOf?: string | null) => void;
  addTransaction: (transaction: Transaction) => Promise<boolean>;
  editTransaction: (id: string, updates: Partial<Transaction>) => Promise<boolean>;
  deleteTransaction: (id: string) => void;
  /** Bulk delete in ONE state update — looping deleteTransaction would race itself. */
  deleteTransactions: (ids: string[]) => void;
  /** Clears instantly; cloud deletion runs in the background unless waitForCloud. */
  clearAllTransactions: (waitForCloud?: boolean) => Promise<void>;
  importTransactions: (newTransactions: Transaction[], openingBalance?: number, statementStart?: string) => void;
  /** Adds a rule, or changes the kind of the rule with the same match. */
  savePayeeRule: (match: string, kind: PayeeKind) => void;
  deletePayeeRule: (id: string) => void;
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
  const [payeeRules, setPayeeRules] = useState<PayeeRule[]>([]);
  const [dailyLimit, setDailyLimitState] = useState<number>(0);
  const [mfaEnabled, setMfaEnabledState] = useState<boolean>(false);
  const [budgets, setBudgetsState] = useState<Record<string, number>>({});
  const [savingsGoal, setSavingsGoalState] = useState<number>(0);
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

  // Entries saved as UTC timestamps get their local day in the cloud too, once
  // (audit H4). Screens already show the right day from asLoaded; this keeps
  // the stored copy from depending on the phone's time zone. Each entry is
  // tried once per session.
  const dayFixesTried = useRef(new Set<string>());
  const saveLocalDays = useCallback((stored: { ref: DocumentReference; t: Transaction }[]) => {
      const fixes: { ref: DocumentReference; fields: { date: string; createdAt?: string } }[] = [];
      for (const { ref, t } of stored) {
          if (dayFixesTried.current.has(ref.path)) continue;
          const fields = localDayFields(t);
          if (!fields) continue;
          // The update rule's own checks, so one odd document can't fail a batch.
          if (typeof t.amount !== 'number' || !(t.amount > 0)) continue;
          if (t.type !== TransactionType.INCOME && t.type !== TransactionType.EXPENSE) continue;
          dayFixesTried.current.add(ref.path);
          fixes.push({ ref, fields });
      }
      for (const chunk of chunkArray(fixes, 500)) {
          const batch = writeBatch(db);
          chunk.forEach(({ ref, fields }) => batch.update(ref, fields));
          batch.commit().catch(e => log.warn('Saving local days failed:', e?.code || e?.message));
      }
  }, []);

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
        if (localData) setTransactions(asLoaded(localData));
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
            const timestamped: { ref: DocumentReference; t: Transaction }[] = [];
            snapshot.forEach((d) => {
                const t = d.data() as Transaction;
                txData.push(t);
                if (!isDay(t.date)) timestamped.push({ ref: d.ref, t });
            });
            const listed = asLoaded(txData);
            setTransactions(listed);
            scheduleMirror(listed);
            if (timestamped.length > 0) saveLocalDays(timestamped);
        }, (error) => {
            log.warn('Firestore access failed, switching to local-only mode:', error.message);
            setIsBackendReady(false);
            // Keep whatever is already in memory (freshest); only fall back to
            // the mirror when we have nothing.
            setTransactions(prev => {
                if (prev.length > 0) return prev;
                const localData = loadFromLocal('transactions');
                return localData ? asLoaded(localData) : prev;
            });
        });
    } catch (e) {
        log.warn('Firestore setup error:', e);
        setIsBackendReady(false);
        const localData = loadFromLocal('transactions');
        if (localData) setTransactions(asLoaded(localData));
    }

    return () => unsubscribe();
  }, [user, isBackendReady, refreshNonce, loadFromLocal, scheduleMirror, saveLocalDays]);

  // Sync Settings (Currency, Rules, Limits, MFA, Opening Balance)
  useEffect(() => {
      if (!user || !isBackendReady) {
          if (!user) {
              setCurrencyState('INR');
              setPayeeRules([]);
              setDailyLimitState(0);
              setMfaEnabledState(false);
              setOpeningBalanceState(0);
          } else {
               const localCurrency = loadFromLocal('currency');
               if (localCurrency) setCurrencyState(localCurrency);

               setPayeeRules(asPayeeRules(loadFromLocal('payeeRules')));

               const localLimit = loadFromLocal('dailyLimit');
               if (localLimit) setDailyLimitState(localLimit);

               const localMfa = loadFromLocal('mfaEnabled');
               if (localMfa !== null) setMfaEnabledState(localMfa);

               const localBudgets = loadFromLocal('budgets');
               if (localBudgets) setBudgetsState(withListBudgetNames(localBudgets));

               const localGoal = loadFromLocal('savingsGoal');
               if (localGoal !== null) setSavingsGoalState(localGoal || 0);

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
                  if (data.payeeRules !== undefined) {
                      const rules = asPayeeRules(data.payeeRules);
                      setPayeeRules(rules);
                      saveToLocal('payeeRules', rules);
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
                  if (data.budgets) {
                      const budgetsByName = withListBudgetNames(data.budgets);
                      setBudgetsState(budgetsByName);
                      saveToLocal('budgets', budgetsByName);
                  }
                  if (data.savingsGoal !== undefined) {
                      setSavingsGoalState(data.savingsGoal || 0);
                      saveToLocal('savingsGoal', data.savingsGoal || 0);
                  }
              } else if (isOnlineRef.current) {
                  setDoc(settingsRef, {
                      currency: 'INR',
                      dailyLimit: 0,
                      mfaEnabled: false
                  }, { merge: true })
                  .catch(() => log.warn('Failed to init settings on backend'));
              }
          }, (error) => {
              log.warn('Settings listener error, falling back to localStorage:', error.message);
              const localCurrency = loadFromLocal('currency');
              if (localCurrency) setCurrencyState(localCurrency);

              setPayeeRules(asPayeeRules(loadFromLocal('payeeRules')));

              const localOpeningBalance = loadFromLocal('openingBalance');
              if (localOpeningBalance !== null) {
                  setOpeningBalanceState(localOpeningBalance || 0);
              }
          });
      } catch (e) {
           log.warn('Settings sync exception, falling back to localStorage');
           const localCurrency = loadFromLocal('currency');
           if (localCurrency) setCurrencyState(localCurrency);

           setPayeeRules(asPayeeRules(loadFromLocal('payeeRules')));

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

  const setBudget = useCallback(async (category: string, amount: number) => {
      const next = { ...budgets };
      if (amount > 0) next[category] = amount;
      else delete next[category];
      setBudgetsState(next);
      saveToLocal('budgets', next);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { budgets: next }, { merge: true });
          } catch (e) { log.warn('Backend update failed'); }
      }
  }, [budgets, user, isOnline, isBackendReady, saveToLocal]);

  const setSavingsGoal = useCallback(async (amount: number) => {
      const value = Math.max(0, amount || 0);
      setSavingsGoalState(value);
      saveToLocal('savingsGoal', value);
      if (user && isOnline && isBackendReady) {
          try {
              const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
              await setDoc(settingsRef, { savingsGoal: value }, { merge: true });
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

  // ── Spending, income and money moved (audit H3) ───────────────────────────
  // One classifier per rule set. counted leaves money moved out, so totals,
  // charts and insights see only real spending and income.
  const flowOf = useMemo(() => flowClassifier(payeeRules), [payeeRules]);
  const counted = useMemo(
    () => transactions.filter(t => flowOf(t).flow !== 'moved'),
    [transactions, flowOf]
  );

  // ── Aggregates ────────────────────────────────────────────────────────────
  // Recomputed only when data changes (audit Phase 2.3). The balance counts
  // every transaction; income and expense count only counted ones. Dates are
  // local days, so they compare as strings.
  const aggregates = useMemo(() => {
    const dayKey = localDay();
    const monthKey = dayKey.slice(0, 7);

    let net = 0;
    for (const t of transactions) net += t.type === TransactionType.INCOME ? t.amount : -t.amount;

    let totalIncome = 0, totalExpense = 0;
    let monthlyIncome = 0, monthlyExpense = 0;
    let todayIncome = 0, todayExpense = 0;

    for (const t of counted) {
      const isIncome = t.type === TransactionType.INCOME;
      if (isIncome) totalIncome += t.amount; else totalExpense += t.amount;

      if (t.date.slice(0, 7) === monthKey) {
        if (isIncome) monthlyIncome += t.amount; else monthlyExpense += t.amount;
      }
      if (t.date === dayKey) {
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
      balance: openingBalance + net,
    };
  }, [transactions, counted, openingBalance]);

  const getBalance = useCallback(() => aggregates.balance, [aggregates]);
  const getMonthlyIncome = useCallback(() => aggregates.monthlyIncome, [aggregates]);
  const getMonthlyExpense = useCallback(() => aggregates.monthlyExpense, [aggregates]);
  const getDailyIncome = useCallback(() => aggregates.todayIncome, [aggregates]);
  const getDailyExpense = useCallback(() => aggregates.todayExpense, [aggregates]);
  const getTotalIncome = useCallback(() => aggregates.totalIncome, [aggregates]);
  const getTotalExpense = useCallback(() => aggregates.totalExpense, [aggregates]);

  const addTransaction = useCallback(async (transaction: Transaction): Promise<boolean> => {
    // Check Daily Limit (audit Phase 2.8: reuse the aggregate when it is for
    // today; recompute only across a midnight boundary). Only spending counts:
    // money moved to family or your own accounts doesn't use up the limit.
    if (transaction.type === TransactionType.EXPENSE && dailyLimit > 0 && flowOf(transaction).flow === 'spend') {
        const today = localDay();
        const todaySpend = aggregates.dayKey === today
            ? aggregates.todayExpense
            : counted
                .filter(t => t.type === TransactionType.EXPENSE && t.date === today)
                .reduce((acc, t) => acc + t.amount, 0);

        if (todaySpend + transaction.amount > dailyLimit) {
            alert(`Transaction declined. Exceeds daily limit of ${formatAmount(dailyLimit)}.`);
            return false;
        }
    }

    const newTxs = [transaction, ...transactions].sort(byNewest);
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
  }, [transactions, counted, flowOf, dailyLimit, aggregates, formatAmount, persistTransactions, user, isBackendReady]);

  const editTransaction = useCallback(async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) {
        log.error('Edit failed: transaction not found');
        return false;
      }

      const updatedTx = { ...transaction, ...updates, id: transaction.id };
      const newTxs = transactions.map(t => t.id === id ? updatedTx : t);
      if (updatedTx.date !== transaction.date) newTxs.sort(byNewest);
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

  const deleteTransactions = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const newTxs = transactions.filter(t => !idSet.has(t.id));
    setTransactions(newTxs);
    persistTransactions(newTxs);

    if (user && isBackendReady) {
        const uid = user.uid;
        (async () => {
            try {
                const chunks = chunkArray(ids, 500);
                await Promise.all(chunks.map(chunk => {
                    const batch = writeBatch(db);
                    chunk.forEach(id => batch.delete(doc(db, `users/${uid}/transactions/${id}`)));
                    return batch.commit();
                }));
            } catch { log.warn('Bulk delete: backend cleanup failed'); }
        })();
    }
  }, [transactions, persistTransactions, user, isBackendReady]);

  const clearAllTransactions = useCallback(async (waitForCloud = false) => {
    // Capture ids BEFORE wiping state — deleting by known ids skips the
    // expensive getDocs read that made Clear All feel slow.
    const idsToDelete = transactions.map(t => t.id);

    clearingRef.current = true;
    setTransactions([]);
    saveToLocal('transactions', []);
    setOpeningBalanceState(0);
    setOpeningBalanceAsOfState(null);
    saveToLocal('openingBalance', 0);
    saveToLocal('openingBalanceAsOf', null);

    if (!user || !isBackendReady) {
        clearingRef.current = false;
        return;
    }

    // Cloud cleanup runs in the background — the UI is already cleared.
    // Account deletion passes waitForCloud so nothing is orphaned.
    const uid = user.uid;
    const cloudWork = (async () => {
        try {
            const settingsRef = doc(db, `users/${uid}/settings/preferences`);
            setDoc(settingsRef, { openingBalance: 0, openingBalanceAsOf: null }, { merge: true })
                .catch(() => log.warn('Failed to reset opening balance on backend'));

            if (idsToDelete.length > 0) {
                // Parallel batch deletes (500/batch, Firestore limit).
                const chunks = chunkArray(idsToDelete, 500);
                await Promise.all(chunks.map(chunk => {
                    const batch = writeBatch(db);
                    chunk.forEach(id => batch.delete(doc(db, `users/${uid}/transactions/${id}`)));
                    return batch.commit();
                }));
            } else {
                // Local state was empty but the cloud may not be (e.g. clear
                // before first sync) — fall back to a full sweep. Skipped in
                // the normal case so a fresh import can't race the sweep.
                const snapshot = await getDocs(query(collection(db, `users/${uid}/transactions`)));
                const chunks = chunkArray(snapshot.docs, 500);
                await Promise.all(chunks.map(chunk => {
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    return batch.commit();
                }));
            }
        } catch (e) {
            log.warn('Failed to clear backend transactions');
        } finally {
            // Snapshot listener resumes only after the deletes are committed.
            clearingRef.current = false;
        }
    })();
    if (waitForCloud) await cloudWork;
  }, [transactions, user, isBackendReady, saveToLocal]);

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

    const combined = [...uniqueNew, ...transactions].sort(byNewest);

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

  // Payee rules save on this device at once and to the cloud through
  // Firestore's queue, which also holds the write while offline.
  const persistPayeeRules = useCallback((rules: PayeeRule[]) => {
    setPayeeRules(rules);
    saveToLocal('payeeRules', rules);
    if (user && isBackendReady) {
        const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
        setDoc(settingsRef, { payeeRules: rules }, { merge: true })
            .catch(e => log.warn('Saving payee rules failed:', e?.code || e?.message));
    }
  }, [user, isBackendReady, saveToLocal]);

  const savePayeeRule = useCallback((match: string, kind: PayeeKind) => {
    const key = matchText(match);
    if (key.length < MIN_MATCH) return;
    const same = payeeRules.find(r => matchText(r.match) === key);
    const id = `rule-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
    persistPayeeRules(same
        ? payeeRules.map(r => (r === same ? { ...r, kind } : r))
        : [...payeeRules, { id, match: match.trim(), kind }]);
  }, [payeeRules, persistPayeeRules]);

  const deletePayeeRule = useCallback((id: string) => {
    persistPayeeRules(payeeRules.filter(r => r.id !== id));
  }, [payeeRules, persistPayeeRules]);

  // Memoized provider value (audit Phase 2.1) — consumers no longer re-render
  // from identity churn alone.
  const value = useMemo<WalletContextType>(() => ({
      transactions,
      currency,
      payeeRules,
      flowOf,
      counted,
      dailyLimit,
      mfaEnabled,
      isOnline,
      isCloudSyncing: isOnline && isBackendReady,
      budgets,
      savingsGoal,
      setCurrency,
      setDailyLimit,
      setMfaEnabled,
      setBudget,
      setSavingsGoal,
      setOpeningBalance,
      addTransaction,
      editTransaction,
      deleteTransaction,
      deleteTransactions,
      clearAllTransactions,
      importTransactions,
      savePayeeRule,
      deletePayeeRule,
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
      transactions, currency, payeeRules, flowOf, counted, dailyLimit, mfaEnabled, isOnline,
      isBackendReady, openingBalance, openingBalanceAsOf, budgets, savingsGoal,
      setCurrency, setDailyLimit, setMfaEnabled, setBudget, setSavingsGoal,
      setOpeningBalance, addTransaction, editTransaction, deleteTransaction,
      deleteTransactions, clearAllTransactions, importTransactions, savePayeeRule, deletePayeeRule, getBalance,
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
