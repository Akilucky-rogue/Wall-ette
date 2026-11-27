import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { Transaction, TransactionType, CurrencyCode, PayeeKind, PayeeRule, CATEGORIES, canonicalCategory } from '../types';
import app, { auth, db, firestoreRestBase } from '../services/firebase';
import { collection, query, onSnapshot, doc, setDoc, getDoc, getDocsFromServer, serverTimestamp, writeBatch, getDocs, orderBy, DocumentReference, deleteField } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { FALLBACK_RATES, getCurrencyFormatter, getCompactCurrencyFormatter, getWholeCurrencyFormatter, isCurrencyCode } from '../utils/currencyUtils';
import { byNewest, fromTimestamp, isDay, localDay } from '../utils/dates';
import { FlowInfo, flowClassifier, matchText, MIN_MATCH } from '../services/spend';
import { sendToCloud, setCloudOwner } from '../services/cloudSaves';
import { log } from '../utils/log';
import { markTiming } from '../utils/timing';
import { mergeImport, type StatementAccount } from '../services/statementImport';
import { type AccountAnchor, asAccountAnchors, totalOpening } from '../services/accounts';
import { reversalPairs } from '../services/reversals';
import { categoryToStore, shownCategory, withShownCategories } from '../services/review';
import { asImportReceipts, withReceipt, type ImportReceipt } from '../services/importReceipt';
import type { BackupSettings } from '../services/backup';
import { changesSynced } from '../services/session';
import { emptyLayout, MONTH_DOC_ID, readMonths, type MonthLayout } from '../services/months';
import {
  clearOldEntries, deleteMonths, deleteOldEntries, listOldEntries, monthsCollection, moveToMonths, saveToMonths,
  type Moved, type RestTarget,
} from '../services/monthStore';

export interface ImportOptions {
  /** The statement's opening balance, when it shows one (or its rows give it). */
  opening?: number;
  /** The statement's first day. */
  statementStart?: string;
  /** Balance adjustments the statement replaces. */
  removeIds?: string[];
  /** The account it's from, when it shows its number. */
  account?: StatementAccount;
  /** Every row read from it, ticked or not. */
  rowIds?: string[];
}

export interface ImportOutcome {
  added: number;
  removed: number;
  /** Entries already in the wallet now marked with the statement's account. */
  retagged: number;
  /** An opening balance was set or moved. */
  openingSet: boolean;
}

// Firestore refuses fields set to undefined; leave them out.
const forCloud = <T extends object,>(t: T): T =>
  Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as T;

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
// A rule's category, kept only on a rule that counts and only when it's a list name.
const RULE_CATEGORIES = new Set<string>(CATEGORIES);
const asPayeeRules = (raw: unknown): PayeeRule[] =>
  Array.isArray(raw)
    ? raw
        .filter((r): r is PayeeRule =>
          !!r && typeof r.id === 'string' && typeof r.match === 'string' &&
          matchText(r.match).length >= MIN_MATCH && PAYEE_KINDS.has(r.kind))
        .map(r => {
          const { category, ...rule } = r;
          return r.kind === 'counts' && typeof category === 'string' && RULE_CATEGORIES.has(category) ? { ...rule, category } : rule;
        })
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
  /**
   * The entries as saved. `transactions` shows each under the category it
   * reads as (services/review.ts: "To review", a payee's category); backups
   * and anything written back use these.
   */
  storedTransactions: Transaction[];
  /** What each statement import did, newest first (services/importReceipt.ts). */
  importReceipts: ImportReceipt[];
  saveImportReceipt: (receipt: ImportReceipt) => void;
  dailyLimit: number;
  mfaEnabled: boolean;
  /** Per-category monthly budgets (INR base). */
  budgets: Record<string, number>;
  /** Monthly savings target (INR base, 0 = unset). */
  savingsGoal: number;
  isOnline: boolean;
  isCloudSyncing: boolean;
  /**
   * False while the wallet is still on its way: signed in on a phone for the
   * first time, or after signing out (which clears this device's copy), the
   * entries come from the cloud, which takes a few seconds for thousands of
   * them. Screens show that it's arriving rather than an empty wallet.
   */
  walletLoaded: boolean;
  /**
   * The wallet's opening balance: every account's (what each held before its
   * earliest statement here) plus the one from before 1.5.9. Balance is this
   * plus every entry.
   */
  openingBalance: number;
  /** The opening balance not tied to an account (wallets from before 1.5.9). */
  unassignedOpening: number;
  /** ISO date that one is anchored to (start of the earliest statement it came from). */
  openingBalanceAsOf: string | null;
  /** Each bank account's own opening balance, by accountKey (services/accounts.ts). */
  accounts: Record<string, AccountAnchor>;
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
  /**
   * Adds a statement's rows (skipping ids the wallet has), takes out the
   * stale balance adjustments named in `removeIds`, and sets or moves the
   * opening balance of the statement's account (or, with none, the
   * wallet's) when this is its earliest statement. One step, one list
   * (services/statementImport.ts mergeImport): the balance stays every
   * opening plus every entry.
   */
  importTransactions: (newTransactions: Transaction[], options?: ImportOptions) => ImportOutcome;
  /**
   * Data Studio → Restore: puts back a backup's settings. The opening balance,
   * and each budget, goal and limit the file holds, replace the ones here;
   * Money moved rules are added unless one with the same match is here.
   */
  restoreSettings: (settings: BackupSettings) => void;
  /**
   * Adds a rule, or changes the rule with the same match. A rule that counts
   * may name the category its payments show under.
   */
  savePayeeRule: (match: string, kind: PayeeKind, category?: string) => void;
  deletePayeeRule: (id: string) => void;
  getBalance: () => number;
  getMonthlyIncome: () => number;
  getMonthlyExpense: () => number;
  getDailyIncome: () => number;
  getDailyExpense: () => number;
  getTotalIncome: () => number;
  getTotalExpense: () => number;
  formatAmount: (amountInBase: number) => string;
  /** Whole units, no decimals: for figures read at a glance. */
  formatWhole: (amountInBase: number) => string;
  /** One entry's amount: as typed when it was typed in the currency shown, else converted. */
  formatEntry: (t: Pick<Transaction, 'amount' | 'typedAmount' | 'typedCurrency'>, whole?: boolean) => string;
  formatAmountCompact: (amountInBase: number) => string;
  convertToBase: (amount: number) => number;
  /** The currency amounts are shown in (the chosen one once its rate is known, else INR). */
  shownCurrency: CurrencyCode;
  /** Rate of the shown currency per 1 INR. */
  shownRate: number;
  /** Live rates per 1 INR, for the currency picker. */
  exchangeRates: Record<string, number>;
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

// Every currency the rate service knows (about 160, utils/currencyUtils.ts).
const FX_CACHE_KEY = 'fxRates_v2';
const FX_TTL_MS = 60 * 60 * 1000; // 1 hour


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

// Rejects if `p` hasn't settled within `ms`; `p` itself carries on.
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout')), ms);
  p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
});

// Firestore's REST API as the signed-in user, for the move to month storage.
const restTarget = (): RestTarget => ({
  projectId: app.options.projectId ?? '',
  base: firestoreRestBase,
  token: () => (auth.currentUser ? auth.currentUser.getIdToken() : Promise.reject(new Error('Signed out'))),
});

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // The newest list, ahead of React's next render: every change builds on it,
  // so two changes in a row (an import that also removes adjustments, two
  // quick saves) can't undo each other.
  const listRef = useRef<Transaction[]>([]);
  useEffect(() => { listRef.current = transactions; }, [transactions]);
  const [currency, setCurrencyState] = useState<CurrencyCode>('INR');
  const [payeeRules, setPayeeRules] = useState<PayeeRule[]>([]);
  const [importReceipts, setImportReceipts] = useState<ImportReceipt[]>([]);
  const [dailyLimit, setDailyLimitState] = useState<number>(0);
  const [mfaEnabled, setMfaEnabledState] = useState<boolean>(false);
  const [budgets, setBudgetsState] = useState<Record<string, number>>({});
  const [savingsGoal, setSavingsGoalState] = useState<number>(0);
  const [lastLoginTime, setLastLoginTime] = useState<Date | null>(null);
  const [openingBalance, setOpeningBalanceState] = useState<number>(0);
  const [openingBalanceAsOf, setOpeningBalanceAsOfState] = useState<string | null>(null);
  const [accounts, setAccountsState] = useState<Record<string, AccountAnchor>>({});

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Backend ready state to handle cases where DB doesn't exist
  const [isBackendReady, setIsBackendReady] = useState(true);
  // Bumped by refresh() — re-runs the listener effects for a fresh server pull.
  const [refreshNonce, setRefreshNonce] = useState(0);
  // Whether this user's entries have arrived (see WalletContextType).
  const [walletLoaded, setWalletLoaded] = useState(false);
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
                // Every currency with a usable rate (per 1 INR).
                const rates: Record<string, number> = {};
                for (const [code, rate] of Object.entries(data?.rates ?? {})) {
                    if (isCurrencyCode(code) && typeof rate === 'number' && rate > 0) rates[code] = rate;
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

  // The currency amounts are shown in, and its rate per 1 INR. A currency
  // whose rate isn't known yet (offline on a first start) shows as INR.
  const { shownCurrency, shownRate } = useMemo(() => {
      const rate = exchangeRates[currency] ?? FALLBACK_RATES[currency];
      return rate && rate > 0 ? { shownCurrency: currency, shownRate: rate } : { shownCurrency: 'INR', shownRate: 1 };
  }, [currency, exchangeRates]);

  // Amounts in the shown currency, with its own decimal places. Cached
  // Intl.NumberFormat per currency (audit Phase 2.2).
  const formatAmount = useCallback((amountInBase: number): string =>
      getCurrencyFormatter(shownCurrency).format(amountInBase * shownRate), [shownCurrency, shownRate]);

  // Whole units, for figures read at a glance: ₹1,23,457, $1,335.
  const formatWhole = useCallback((amountInBase: number): string =>
      getWholeCurrencyFormatter(shownCurrency).format(Math.round(amountInBase * shownRate)), [shownCurrency, shownRate]);

  // Short form for chart axes: ₹85.7K instead of ₹85,707.00
  const formatEntry = useCallback((t: Pick<Transaction, 'amount' | 'typedAmount' | 'typedCurrency'>, whole = false): string => {
      const shown = t.typedCurrency === shownCurrency && typeof t.typedAmount === 'number' && Number.isFinite(t.typedAmount)
        ? t.typedAmount
        : t.amount * shownRate;
      return whole
        ? getWholeCurrencyFormatter(shownCurrency).format(Math.round(shown))
        : getCurrencyFormatter(shownCurrency).format(shown);
  }, [shownCurrency, shownRate]);

  const formatAmountCompact = useCallback((amountInBase: number): string =>
      getCompactCurrencyFormatter(shownCurrency).format(amountInBase * shownRate), [shownCurrency, shownRate]);

  // An amount typed in the shown currency, back to INR for storage.
  const convertToBase = useCallback((amount: number): number => amount / shownRate, [shownRate]);

  // Local Storage Fallback Helpers
  const saveToLocal = useCallback((key: string, data: any) => {
      // Also skipped once this user has signed out or deleted the account, so
      // a late mirror write can't put back a key services/session.ts removed.
      if (!user || auth.currentUser?.uid !== user.uid) return;
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

  // ── Where the entries are kept (docs/PLAN_1.6.0.md) ──────────────────────
  // 'months' from 1.6.0: one document per month (services/monthStore.ts).
  // 'legacy': one document per entry, as up to 1.5.9, until this wallet's
  // one-time move has run; it runs at a start online. 'moving' meanwhile.
  const storageRef = useRef<'legacy' | 'moving' | 'months'>('legacy');
  const layoutRef = useRef<MonthLayout>(emptyLayout());
  // Settles when a move in progress does: cloud writes wait for it.
  const movingRef = useRef<Promise<void>>(Promise.resolve());
  // The move running, so a listener restarted meanwhile joins it.
  const moveRef = useRef<{ uid: string; done: Promise<Moved | null> } | null>(null);
  // The listeners restarted once because another device moved this wallet.
  const switchedRef = useRef(false);

  // Moves this wallet's entries to month documents, once. Null if it
  // couldn't (offline, refused); it's tried again at the next start.
  const moveWallet = useCallback((uid: string): Promise<Moved | null> => {
      if (moveRef.current?.uid === uid) return moveRef.current.done;
      const settingsRef = doc(db, `users/${uid}/settings/preferences`);
      const done = (async (): Promise<Moved | null> => {
          // 1. This device's queued changes to the old documents reach the cloud first.
          if (!(await changesSynced(20_000))) return null;
          try {
              // 2. From now on older versions can't change the old documents (firestore.rules).
              await withTimeout(setDoc(settingsRef, { entriesIn: 'moving' }, { merge: true }), 15_000);
              // 3. Read them through the REST API, not the offline cache, and write the months.
              const moved = await withTimeout(moveToMonths(db, uid, restTarget()), 120_000);
              // 4. Done. The old documents go once the months are listened to.
              await withTimeout(setDoc(settingsRef,
                  { entriesIn: 'months', entriesMovedAt: serverTimestamp(), oldEntriesLeft: moved.oldNames.length > 0 },
                  { merge: true }), 15_000);
              if (auth.currentUser?.uid === uid) {
                  layoutRef.current = moved.layout;
                  storageRef.current = 'months';
                  saveToLocal('entriesIn', 'months');
              }
              log.debug(`Moved ${moved.entries.length} entries to month storage`);
              return moved;
          } catch (e: any) {
              log.warn('Moving entries to month storage failed:', e?.code || e?.message);
              // Older versions may write to the old documents again until the next try.
              void setDoc(settingsRef, { entriesIn: deleteField() }, { merge: true }).catch(() => {});
              return null;
          }
      })().then(moved => {
          if (!moved && auth.currentUser?.uid === uid) storageRef.current = 'legacy';
          if (moveRef.current?.uid === uid) moveRef.current = null;
          return moved;
      });
      moveRef.current = { uid, done };
      movingRef.current = done.then(() => undefined);
      return done;
  }, [saveToLocal]);

  // Deletes what a move left in the old collection (settings.oldEntriesLeft),
  // in the background; anything the months lack is saved to them first, so
  // it needs the months as the cloud has them: the move's own layout, or a
  // fresh read. Once done, this device stops asking.
  const clearOldIfLeft = useCallback(async (uid: string, moved?: MonthLayout) => {
      if (loadFromLocal('oldEntriesCleared') === true) return;
      const settingsRef = doc(db, `users/${uid}/settings/preferences`);
      try {
          if ((await getDoc(settingsRef)).get('oldEntriesLeft') === true) {
              const layout = moved ?? readMonths((await getDocsFromServer(monthsCollection(db, uid))).docs
                  .filter(d => MONTH_DOC_ID.test(d.id))
                  .map(d => ({ id: d.id, entries: d.get('entries') }))).layout;
              const left = await clearOldEntries(db, uid, restTarget(), layout);
              await setDoc(settingsRef, { oldEntriesLeft: false }, { merge: true });
              log.debug(`Deleted ${left} old entry documents`);
          }
          saveToLocal('oldEntriesCleared', true);
      } catch (e: any) {
          log.warn('Old entry documents not deleted yet:', e?.code || e?.message);
      }
  }, [loadFromLocal, saveToLocal]);

  // Sync Transactions
  useEffect(() => {
    if (!user) {
        setTransactions([]);
        setWalletLoaded(false);
        storageRef.current = 'legacy';
        layoutRef.current = emptyLayout();
        switchedRef.current = false;
        return;
    }

    if (!isBackendReady) {
        const localData = loadFromLocal('transactions');
        if (localData) setTransactions(asLoaded(localData));
        setWalletLoaded(true);
        return;
    }

    const uid = user.uid;
    let cancelled = false;
    let unsubscribe = () => {};
    let stopRetry = () => {};
    // How long the entries take to arrive, in a performance trace.
    markTiming('wallet:listen', 'signin:done');
    let arrived = false;
    // The wallet has arrived with its first entries from this device, or
    // with the cloud's answer (an empty wallet is empty only once the cloud
    // says so). Offline, an empty copy is all there is.
    const markArrived = (size: number, fromCache: boolean) => {
        if (arrived || !(size > 0 || !fromCache || !navigator.onLine)) return;
        arrived = true;
        markTiming('wallet:arrived', 'wallet:listen');
        setWalletLoaded(true);
    };
    const onListenError = (error: { message: string }) => {
        log.warn('Firestore access failed, switching to local-only mode:', error.message);
        setWalletLoaded(true);
        setIsBackendReady(false);
        // Keep whatever is already in memory (freshest); only fall back to
        // the mirror when we have nothing.
        setTransactions(prev => {
            if (prev.length > 0) return prev;
            const localData = loadFromLocal('transactions');
            return localData ? asLoaded(localData) : prev;
        });
    };

    // From 1.6.0: one document per month.
    const listenMonths = () => {
        storageRef.current = 'months';
        unsubscribe = onSnapshot(monthsCollection(db, uid), (snapshot) => {
            markArrived(snapshot.size, snapshot.metadata.fromCache);
            // Ignore echoes while Clear All is deleting.
            if (clearingRef.current) return;
            const { entries, layout } = readMonths(snapshot.docs
                .filter(d => MONTH_DOC_ID.test(d.id))
                .map(d => ({ id: d.id, entries: d.get('entries') })));
            layoutRef.current = layout;
            const listed = asLoaded(entries);
            setTransactions(listed);
            scheduleMirror(listed);
        }, onListenError);
    };

    // Up to 1.5.9, and until this wallet's move has run: one document per entry.
    const listenLegacy = () => {
        storageRef.current = 'legacy';
        // Sorted by date descending in the database
        const q = query(collection(db, `users/${uid}/transactions`), orderBy('date', 'desc'));
        unsubscribe = onSnapshot(q, (snapshot) => {
            markArrived(snapshot.size, snapshot.metadata.fromCache);
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
        }, onListenError);
    };

    // One document per entry for now; offline, the move runs once this
    // device is back online.
    const fallBack = () => {
        listenLegacy();
        if (navigator.onLine) return;
        const retry = () => setRefreshNonce(n => n + 1);
        window.addEventListener('online', retry, { once: true });
        stopRetry = () => window.removeEventListener('online', retry);
    };

    void (async () => {
        try {
            let entriesIn: unknown = loadFromLocal('entriesIn');
            if (entriesIn !== 'months') {
                entriesIn = (await getDoc(doc(db, `users/${uid}/settings/preferences`))).get('entriesIn');
                if (cancelled) return;
            }
            if (entriesIn === 'months') {
                saveToLocal('entriesIn', 'months');
                listenMonths();
                // A move cut short before its old documents went.
                if (navigator.onLine) void clearOldIfLeft(uid);
                return;
            }
            if (!navigator.onLine) {
                fallBack();
                return;
            }
            // The move. Meanwhile this device's last copy shows (if it has
            // one) and changes wait for it.
            storageRef.current = 'moving';
            const mirror = loadFromLocal('transactions');
            if (mirror && listRef.current.length === 0) setTransactions(asLoaded(mirror));
            const moved = await moveWallet(uid);
            if (cancelled) return;
            if (moved) {
                listenMonths();
                void clearOldIfLeft(uid, moved.layout);
            } else {
                fallBack();
            }
        } catch (e: any) {
            // Offline with no settings on this device yet, say.
            log.warn('Checking where the entries are kept failed:', e?.code || e?.message);
            if (!cancelled) fallBack();
        }
    })();

    return () => { cancelled = true; unsubscribe(); stopRetry(); };
  }, [user, isBackendReady, refreshNonce, loadFromLocal, saveToLocal, scheduleMirror, saveLocalDays, moveWallet, clearOldIfLeft]);

  // Sync Settings (Currency, Rules, Limits, MFA, Opening Balance)
  useEffect(() => {
      if (!user || !isBackendReady) {
          if (!user) {
              setCurrencyState('INR');
              setPayeeRules([]);
              setImportReceipts([]);
              setDailyLimitState(0);
              setMfaEnabledState(false);
              setOpeningBalanceState(0);
          } else {
               const localCurrency = loadFromLocal('currency');
               if (localCurrency) setCurrencyState(localCurrency);

               setPayeeRules(asPayeeRules(loadFromLocal('payeeRules')));
               setImportReceipts(asImportReceipts(loadFromLocal('importReceipts')));

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
               setAccountsState(asAccountAnchors(loadFromLocal('accounts')));
          }
          return;
      }

      let unsubscribe = () => {};

      try {
          const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
          unsubscribe = onSnapshot(settingsRef, (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  // Another device moved this wallet to month storage while
                  // this one was listening to one document per entry.
                  if (data.entriesIn === 'months' && storageRef.current === 'legacy' && !switchedRef.current) {
                      switchedRef.current = true;
                      setRefreshNonce(n => n + 1);
                  }
                  if (isCurrencyCode(data.currency)) {
                      setCurrencyState(data.currency);
                      saveToLocal('currency', data.currency);
                  }
                  if (data.payeeRules !== undefined) {
                      const rules = asPayeeRules(data.payeeRules);
                      setPayeeRules(rules);
                      saveToLocal('payeeRules', rules);
                  }
                  if (data.importReceipts !== undefined) {
                      const receipts = asImportReceipts(data.importReceipts);
                      setImportReceipts(receipts);
                      saveToLocal('importReceipts', receipts);
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
                  {
                      const anchors = asAccountAnchors(data.accounts);
                      setAccountsState(anchors);
                      saveToLocal('accounts', anchors);
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
              setImportReceipts(asImportReceipts(loadFromLocal('importReceipts')));

              const localOpeningBalance = loadFromLocal('openingBalance');
              if (localOpeningBalance !== null) {
                  setOpeningBalanceState(localOpeningBalance || 0);
              }
              setAccountsState(asAccountAnchors(loadFromLocal('accounts')));
          });
      } catch (e) {
           log.warn('Settings sync exception, falling back to localStorage');
           const localCurrency = loadFromLocal('currency');
           if (localCurrency) setCurrencyState(localCurrency);

           setPayeeRules(asPayeeRules(loadFromLocal('payeeRules')));
           setImportReceipts(asImportReceipts(loadFromLocal('importReceipts')));

           const localOpeningBalance = loadFromLocal('openingBalance');
           if (localOpeningBalance !== null) {
               setOpeningBalanceState(localOpeningBalance || 0);
           }
           setAccountsState(asAccountAnchors(loadFromLocal('accounts')));
      }

      return () => unsubscribe();
  }, [user, isBackendReady, refreshNonce, loadFromLocal, saveToLocal]);

  const retryCloudConnection = useCallback(() => {
      setIsBackendReady(true);
  }, []);

  // ── Cloud writes (audit M4) ───────────────────────────────────────────────
  // Every change goes to Firestore, which shows it here at once and queues it
  // until the server has it, also offline, and also when the listeners have
  // fallen back to this device's copy. Refused changes are kept by
  // services/cloudSaves.ts for the "didn't save" banner.
  useEffect(() => { setCloudOwner(user?.uid ?? null); }, [user]);

  const saveSetting = useCallback((field: string, fields: Record<string, unknown>) => {
      if (!user) return;
      const settingsRef = doc(db, `users/${user.uid}/settings/preferences`);
      void sendToCloud(`settings:${field}`, 1, () => setDoc(settingsRef, fields, { merge: true }));
  }, [user]);

  // Saves entries whole and takes entries out, wherever this wallet keeps
  // them (storageRef), after any move in progress. A refusal is kept for the
  // "didn't save" banner, and its Try again goes wherever they're kept then.
  const saveEntries = useCallback((uid: string, key: string, set: Transaction[], remove: Pick<Transaction, 'id' | 'date'>[] = []): Promise<boolean> =>
      sendToCloud(key, Math.max(1, set.length + remove.length), async () => {
          await movingRef.current;
          if (storageRef.current === 'months') {
              await saveToMonths(db, uid, layoutRef.current, set, remove);
              return;
          }
          // One document per entry. Every batch is handed to Firestore at
          // once: an import made offline keeps every row (audit M4).
          const writes = [...set.map(t => ({ t, gone: false })), ...remove.map(t => ({ t, gone: true }))];
          await Promise.all(chunkArray(writes, 500).map(chunk => {
              const batch = writeBatch(db);
              for (const { t, gone } of chunk) {
                  const ref = doc(db, `users/${uid}/transactions/${t.id}`);
                  if (gone) batch.delete(ref);
                  else batch.set(ref, forCloud(t as Transaction));
              }
              return batch.commit();
          }));
      }), []);

  // Manual refresh: re-arm backend mode and force both listeners to
  // re-subscribe (fresh server snapshot). Safe to spam.
  const refresh = useCallback(() => {
      setIsBackendReady(true);
      setRefreshNonce(n => n + 1);
  }, []);

  // Settings used to skip the cloud while offline, so the next sync put the
  // old value back; Firestore's queue now holds them until it reconnects.
  const setCurrency = useCallback((code: CurrencyCode) => {
    if (!isCurrencyCode(code)) return;
    setCurrencyState(code);
    saveToLocal('currency', code);
    saveSetting('currency', { currency: code });
  }, [saveToLocal, saveSetting]);

  const setDailyLimit = useCallback((limit: number) => {
      setDailyLimitState(limit);
      saveToLocal('dailyLimit', limit);
      saveSetting('dailyLimit', { dailyLimit: limit });
  }, [saveToLocal, saveSetting]);

  const setMfaEnabled = useCallback((enabled: boolean) => {
      setMfaEnabledState(enabled);
      saveToLocal('mfaEnabled', enabled);
      saveSetting('mfaEnabled', { mfaEnabled: enabled });
  }, [saveToLocal, saveSetting]);

  const setBudget = useCallback((category: string, amount: number) => {
      const next = { ...budgets };
      if (amount > 0) next[category] = amount;
      else delete next[category];
      setBudgetsState(next);
      saveToLocal('budgets', next);
      saveSetting('budgets', { budgets: next });
  }, [budgets, saveToLocal, saveSetting]);

  const setSavingsGoal = useCallback((amount: number) => {
      const value = Math.max(0, amount || 0);
      setSavingsGoalState(value);
      saveToLocal('savingsGoal', value);
      saveSetting('savingsGoal', { savingsGoal: value });
  }, [saveToLocal, saveSetting]);

  const setOpeningBalance = useCallback((balance: number, asOf: string | null = null) => {
      setOpeningBalanceState(balance);
      setOpeningBalanceAsOfState(asOf);
      saveToLocal('openingBalance', balance);
      saveToLocal('openingBalanceAsOf', asOf);
      saveSetting('openingBalance', { openingBalance: balance, openingBalanceAsOf: asOf });
  }, [saveToLocal, saveSetting]);

  // One account's opening balance, saved with the others. The ref keeps
  // several in one turn (a restore) from overwriting each other.
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;
  const setAccountAnchor = useCallback((key: string, anchor: AccountAnchor) => {
      const next = { ...accountsRef.current, [key]: anchor };
      accountsRef.current = next;
      setAccountsState(next);
      saveToLocal('accounts', next);
      saveSetting('accounts', { accounts: next });
  }, [saveToLocal, saveSetting]);

  // Every account's opening plus the one from before accounts.
  const walletOpening = useMemo(() => totalOpening(openingBalance, accounts), [openingBalance, accounts]);

  // ── Spending, income and money moved (audit H3) ───────────────────────────
  // One classifier per rule set. counted leaves money moved out, so totals,
  // charts and insights see only real spending and income.
  // A payment and its reversal (same bank reference and amount) cancel out.
  const reversed = useMemo(() => reversalPairs(transactions), [transactions]);
  const flowOf = useMemo(() => flowClassifier(payeeRules, reversed), [payeeRules, reversed]);
  // Every screen sees each entry under the category it reads as: a transfer
  // nobody has sorted is "To review", a sorted payee's under its category.
  const shown = useMemo(() => withShownCategories(transactions, flowOf), [transactions, flowOf]);
  const counted = useMemo(
    () => shown.filter(t => flowOf(t).flow !== 'moved'),
    [shown, flowOf]
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
      balance: walletOpening + net,
    };
  }, [transactions, counted, walletOpening]);

  const getBalance = useCallback(() => aggregates.balance, [aggregates]);
  const getMonthlyIncome = useCallback(() => aggregates.monthlyIncome, [aggregates]);
  const getMonthlyExpense = useCallback(() => aggregates.monthlyExpense, [aggregates]);
  const getDailyIncome = useCallback(() => aggregates.todayIncome, [aggregates]);
  const getDailyExpense = useCallback(() => aggregates.todayExpense, [aggregates]);
  const getTotalIncome = useCallback(() => aggregates.totalIncome, [aggregates]);
  const getTotalExpense = useCallback(() => aggregates.totalExpense, [aggregates]);

  const addTransaction = useCallback(async (transaction: Transaction): Promise<boolean> => {
    // The daily limit is a warning, not a gate: New Entry says when an entry
    // takes today past it, and the bell on Home reports it. A real expense is
    // always saved.
    const newTxs = [transaction, ...listRef.current.filter(t => t.id !== transaction.id)].sort(byNewest);
    listRef.current = newTxs;
    setTransactions(newTxs);
    persistTransactions(newTxs);

    if (user) void saveEntries(user.uid, `tx:${transaction.id}`, [transaction]);
    return true;
  }, [persistTransactions, user, saveEntries]);

  const editTransaction = useCallback(async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
    const current = listRef.current;
    const transaction = current.find(t => t.id === id);
    if (!transaction) {
      log.error('Edit failed: transaction not found');
      return false;
    }

    // The Edit dialog starts from the category the entry shows ("To review",
    // a payee's category); saved unchanged, the stored one stays.
    const changes = updates.category === undefined ? updates
      : { ...updates, category: categoryToStore(transaction, shownCategory(transaction, flowOf(transaction)), updates.category) };
    const updatedTx = { ...transaction, ...changes, id: transaction.id };
    const newTxs = current.map(t => t.id === id ? updatedTx : t);
    if (updatedTx.date !== transaction.date) newTxs.sort(byNewest);
    listRef.current = newTxs;
    setTransactions(newTxs);
    persistTransactions(newTxs);

    // The whole entry, so sending it again after a refusal, or for an entry
    // only this device had, still works.
    if (user) void saveEntries(user.uid, `tx:${id}`, [updatedTx]);
    return true;
  }, [persistTransactions, user, flowOf, saveEntries]);

  const deleteTransaction = useCallback((id: string) => {
    const gone = listRef.current.find(t => t.id === id) ?? { id, date: '' };
    const newTxs = listRef.current.filter(t => t.id !== id);
    listRef.current = newTxs;
    setTransactions(newTxs);
    persistTransactions(newTxs);

    if (user) void saveEntries(user.uid, `tx:${id}`, [], [gone]);
  }, [persistTransactions, user, saveEntries]);

  // Deletes in batches of 500, Firestore's limit, all handed over at once.
  const deleteInBatches = useCallback((uid: string, ids: string[]): Promise<boolean>[] =>
    chunkArray(ids, 500).map(chunk =>
      sendToCloud(`delete:${chunk[0]}`, chunk.length, () => {
        const batch = writeBatch(db);
        chunk.forEach(id => batch.delete(doc(db, `users/${uid}/transactions/${id}`)));
        return batch.commit();
      })), []);

  const deleteTransactions = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const byId = new Map(listRef.current.map(t => [t.id, t]));
    const newTxs = listRef.current.filter(t => !idSet.has(t.id));
    listRef.current = newTxs;
    setTransactions(newTxs);
    persistTransactions(newTxs);
    if (user) void saveEntries(user.uid, `delete:${ids[0]}`, [], ids.map(id => byId.get(id) ?? { id, date: '' }));
  }, [persistTransactions, user, saveEntries]);

  const clearAllTransactions = useCallback(async (waitForCloud = false) => {
    // Capture ids BEFORE wiping state — deleting by known ids skips the
    // expensive getDocs read that made Clear All feel slow.
    const idsToDelete = listRef.current.map(t => t.id);
    const monthIds = [...layoutRef.current.sizes.keys()];
    const inMonths = storageRef.current !== 'legacy';

    clearingRef.current = true;
    layoutRef.current = emptyLayout();
    listRef.current = [];
    setTransactions([]);
    saveToLocal('transactions', []);
    setOpeningBalanceState(0);
    setOpeningBalanceAsOfState(null);
    saveToLocal('openingBalance', 0);
    saveToLocal('openingBalanceAsOf', null);
    setAccountsState({});
    accountsRef.current = {};
    saveToLocal('accounts', {});

    if (!user) {
        clearingRef.current = false;
        return;
    }

    const uid = user.uid;
    const settingsRef = doc(db, `users/${uid}/settings/preferences`);
    const resetOpening = { openingBalance: 0, openingBalanceAsOf: null, accounts: deleteField() };

    if (waitForCloud) {
        // Account deletion: every delete must reach the server before the
        // account goes, or the rules leave the rest orphaned. A failure stops
        // the deletion. Both places entries can be kept, whichever this
        // wallet uses: the old documents through the REST API, which skips
        // the offline cache.
        try {
            await movingRef.current;
            await setDoc(settingsRef, resetOpening, { merge: true });
            await deleteMonths(db, uid, monthIds, true);
            const rest = restTarget();
            await deleteOldEntries(rest, (await listOldEntries(rest, uid)).map(d => d.name));
        } finally {
            clearingRef.current = false;
        }
        return;
    }

    // In the background: the screen is already clear, and refusals go to the
    // "didn't save" banner. The listener resumes once every delete settles.
    const work: Promise<boolean>[] = [
        sendToCloud('settings:openingBalance', 1, () => setDoc(settingsRef, resetOpening, { merge: true })),
    ];
    if (inMonths) {
        // Whole month documents; with none known yet, every one the cloud has.
        work.push(sendToCloud('clear:months', 1, async () => {
            await movingRef.current;
            await deleteMonths(db, uid, monthIds, monthIds.length === 0);
        }));
    } else if (idsToDelete.length > 0) {
        work.push(...deleteInBatches(uid, idsToDelete));
    } else {
        // Local state was empty but the cloud may not be (e.g. clear before
        // first sync), so sweep it. Skipped in the normal case so a fresh
        // import can't race the sweep.
        work.push(sendToCloud('clear:sweep', 1, async () => {
            const snapshot = await getDocs(query(collection(db, `users/${uid}/transactions`)));
            await Promise.all(chunkArray(snapshot.docs, 500).map(chunk => {
                const batch = writeBatch(db);
                chunk.forEach(d => batch.delete(d.ref));
                return batch.commit();
            }));
        }));
    }
    void Promise.all(work).finally(() => { clearingRef.current = false; });
  }, [transactions, user, saveToLocal, deleteInBatches]);

  const importTransactions = useCallback((newTransactions: Transaction[], options: ImportOptions = {}): ImportOutcome => {
    const before = new Map(listRef.current.map(t => [t.id, t]));
    const result = mergeImport(
      { transactions: listRef.current, openingBalance, openingBalanceAsOf, accounts },
      newTransactions,
      options,
    );
    // Balance = every opening + every entry: each account's opening anchors
    // to its earliest statement, so statements tally in any order. Importing
    // a statement again can set an account's opening with nothing to add.
    if (result.opening) setOpeningBalance(result.opening.balance, result.opening.asOf);
    if (result.account) setAccountAnchor(result.account.key, result.account.anchor);
    const openingSet = !!(result.opening || result.account);
    const outcome = { added: result.added.length, removed: result.removed.length, retagged: result.retagged.length, openingSet };
    if (result.added.length === 0 && result.removed.length === 0 && result.retagged.length === 0) {
        if (!openingSet) log.warn('No new unique transactions to import');
        return outcome;
    }

    listRef.current = result.transactions;
    setTransactions(result.transactions);
    persistTransactions(result.transactions);

    if (user) {
        // One change: every batch is handed to Firestore at once, so an
        // import made offline keeps every row (audit M4). Entries marked
        // with their account go back whole, like new ones.
        const first = result.added[0] ?? result.retagged[0];
        void saveEntries(user.uid, `import:${first?.id ?? result.removed[0]}`, [...result.added, ...result.retagged],
            result.removed.map(id => before.get(id) ?? { id, date: '' }));
        log.debug(`Importing ${result.added.length} transactions, marking ${result.retagged.length}, removing ${result.removed.length}`);
    }
    return outcome;
  }, [openingBalance, openingBalanceAsOf, accounts, setOpeningBalance, setAccountAnchor, persistTransactions, user, saveEntries]);

  // Receipts save on this device at once and to the cloud through Firestore's queue.
  const saveImportReceipt = useCallback((receipt: ImportReceipt) => {
    setImportReceipts(prev => {
      const next = withReceipt(prev, receipt);
      saveToLocal('importReceipts', next);
      saveSetting('importReceipts', { importReceipts: next });
      return next;
    });
  }, [saveToLocal, saveSetting]);

  // Payee rules save on this device at once and to the cloud through
  // Firestore's queue, which also holds the write while offline.
  const persistPayeeRules = useCallback((rules: PayeeRule[]) => {
    setPayeeRules(rules);
    saveToLocal('payeeRules', rules);
    saveSetting('payeeRules', { payeeRules: rules });
  }, [saveToLocal, saveSetting]);

  const savePayeeRule = useCallback((match: string, kind: PayeeKind, category?: string) => {
    const key = matchText(match);
    if (key.length < MIN_MATCH) return;
    const same = payeeRules.find(r => matchText(r.match) === key);
    const id = `rule-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
    const withCategory = (rule: PayeeRule): PayeeRule => {
      const { category: _old, ...rest } = rule;
      return kind === 'counts' && category && RULE_CATEGORIES.has(category) ? { ...rest, kind, category } : { ...rest, kind };
    };
    persistPayeeRules(same
        ? payeeRules.map(r => (r === same ? withCategory(r) : r))
        : [...payeeRules, withCategory({ id, match: match.trim(), kind })]);
  }, [payeeRules, persistPayeeRules]);

  const deletePayeeRule = useCallback((id: string) => {
    persistPayeeRules(payeeRules.filter(r => r.id !== id));
  }, [payeeRules, persistPayeeRules]);

  const restoreSettings = useCallback((s: BackupSettings) => {
    if (s.openingBalance !== undefined) setOpeningBalance(s.openingBalance, s.openingBalanceAsOf ?? null);
    if (s.accounts) for (const [key, anchor] of Object.entries(s.accounts)) setAccountAnchor(key, anchor);
    if (s.budgets && Object.keys(s.budgets).length > 0) {
      const next = withListBudgetNames({ ...budgets, ...s.budgets });
      setBudgetsState(next);
      saveToLocal('budgets', next);
      saveSetting('budgets', { budgets: next });
    }
    if (s.savingsGoal) setSavingsGoal(s.savingsGoal);
    if (s.dailyLimit) setDailyLimit(s.dailyLimit);
    if (s.payeeRules && s.payeeRules.length > 0) {
      const matches = new Set(payeeRules.map(r => matchText(r.match)));
      const ids = new Set(payeeRules.map(r => r.id));
      const extra: PayeeRule[] = [];
      for (const r of s.payeeRules) {
        const key = matchText(r.match);
        if (key.length < MIN_MATCH || matches.has(key)) continue;
        matches.add(key);
        const id = ids.has(r.id) ? `rule-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${extra.length}`}` : r.id;
        ids.add(id);
        extra.push(r.kind === 'counts' && r.category && RULE_CATEGORIES.has(r.category)
          ? { id, match: r.match, kind: r.kind, category: r.category }
          : { id, match: r.match, kind: r.kind });
      }
      if (extra.length > 0) persistPayeeRules([...payeeRules, ...extra]);
    }
  }, [budgets, payeeRules, setOpeningBalance, setAccountAnchor, setSavingsGoal, setDailyLimit, saveToLocal, saveSetting, persistPayeeRules]);

  // Memoized provider value (audit Phase 2.1) — consumers no longer re-render
  // from identity churn alone.
  const value = useMemo<WalletContextType>(() => ({
      transactions: shown,
      storedTransactions: transactions,
      importReceipts,
      saveImportReceipt,
      currency,
      payeeRules,
      flowOf,
      counted,
      dailyLimit,
      mfaEnabled,
      isOnline,
      isCloudSyncing: isOnline && isBackendReady,
      walletLoaded,
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
      restoreSettings,
      savePayeeRule,
      deletePayeeRule,
      openingBalance: walletOpening,
      unassignedOpening: openingBalance,
      openingBalanceAsOf,
      accounts,
      getBalance,
      getMonthlyIncome,
      getMonthlyExpense,
      getDailyIncome,
      getDailyExpense,
      getTotalIncome,
      getTotalExpense,
      formatAmount,
      formatWhole,
      formatEntry,
      formatAmountCompact,
      convertToBase,
      shownCurrency,
      shownRate,
      exchangeRates,
      retryCloudConnection,
      refresh,
      lastLoginTime
  }), [
      shown, transactions, importReceipts, saveImportReceipt, currency, payeeRules, flowOf, counted, dailyLimit, mfaEnabled, isOnline,
      isBackendReady, walletLoaded, openingBalance, walletOpening, openingBalanceAsOf, accounts, budgets, savingsGoal,
      setCurrency, setDailyLimit, setMfaEnabled, setBudget, setSavingsGoal,
      setOpeningBalance, addTransaction, editTransaction, deleteTransaction,
      deleteTransactions, clearAllTransactions, importTransactions, restoreSettings, savePayeeRule, deletePayeeRule, getBalance,
      getMonthlyIncome, getMonthlyExpense, getDailyIncome, getDailyExpense,
      getTotalIncome, getTotalExpense, formatAmount, formatWhole, formatAmountCompact,
      convertToBase, shownCurrency, shownRate, exchangeRates, retryCloudConnection, refresh, lastLoginTime, formatEntry
  ]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
