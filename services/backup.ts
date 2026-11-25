/**
 * Data Studio's full backup: the file it writes, and reading one back
 * (Data Studio → Restore from a backup).
 *
 * Version 2 (from 1.5.8) holds every entry and the settings that rebuild the
 * wallet: the opening balance and the day it's anchored to, budgets, the
 * savings goal, the daily limit and the Money moved rules. Version 1 files
 * (1.5.7 and earlier) hold the entries and the opening balance.
 *
 * A restore only adds. Entries the wallet already has (same id) are skipped,
 * so restoring a file twice changes nothing, and nothing in the wallet is
 * deleted. Settings are restored only when the person asks.
 *
 * A file can come from anywhere, so every entry is rebuilt field by field:
 * only the fields an entry has are kept, ids must be usable as Firestore
 * document ids, and anything malformed is counted and left out.
 *
 * Types and the TransactionType enum only, so scripts/check-restore.mjs can
 * test it in Node.
 */
import { TransactionType, type PayeeKind, type PayeeRule, type Transaction } from '../types';

export const BACKUP_APP = 'Wall-ette';
export const BACKUP_VERSION = 2;
/** A 20,000-entry backup is about 5 MB; anything this big isn't one of ours. */
export const MAX_BACKUP_CHARS = 50 * 1024 * 1024;

export interface BackupSettings {
  openingBalance?: number;
  /** The day the opening balance is anchored to ('YYYY-MM-DD'), or null. */
  openingBalanceAsOf?: string | null;
  /** Monthly budget per category, in rupees. */
  budgets?: Record<string, number>;
  savingsGoal?: number;
  dailyLimit?: number;
  payeeRules?: PayeeRule[];
}

export interface WalletBackup {
  app: string;
  version: number;
  exportedAt: string;
  /** Also inside settings; kept here, where version 1 put it. */
  openingBalance: number;
  transactionCount: number;
  transactions: Transaction[];
  settings: BackupSettings;
}

export interface WalletForBackup {
  transactions: readonly Transaction[];
  openingBalance: number;
  openingBalanceAsOf: string | null;
  budgets: Record<string, number>;
  savingsGoal: number;
  dailyLimit: number;
  payeeRules: readonly PayeeRule[];
}

export function buildBackup(wallet: WalletForBackup, now: Date = new Date()): WalletBackup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    openingBalance: wallet.openingBalance,
    transactionCount: wallet.transactions.length,
    transactions: [...wallet.transactions],
    settings: {
      openingBalance: wallet.openingBalance,
      openingBalanceAsOf: wallet.openingBalanceAsOf,
      budgets: { ...wallet.budgets },
      savingsGoal: wallet.savingsGoal,
      dailyLimit: wallet.dailyLimit,
      payeeRules: wallet.payeeRules.map(r => ({ ...r })),
    },
  };
}

// ── Reading a file back ──────────────────────────────────────────────────────

export type BackupProblem =
  | 'too-big'        // far larger than any backup
  | 'not-json'       // not a JSON file
  | 'not-backup'     // JSON, but not a Wall-ette backup
  | 'newer-version'  // written by a newer Wall-ette
  | 'empty';         // a backup with no entries and no settings

export interface ReadBackup {
  version: number;
  /** When the backup was made (ISO), if the file says. */
  exportedAt: string | null;
  entries: Transaction[];
  /** Rows that weren't a valid entry, left out. */
  unreadable: number;
  /** Rows that repeated an id already in the file, left out. */
  repeated: number;
  settings: BackupSettings;
}

export type ReadResult = { ok: true; backup: ReadBackup } | { ok: false; problem: BackupProblem };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Firestore keeps __name__ keys for itself; these and prototype names are never data. */
const unsafeKey = (k: string) => /^__.*__$/.test(k) || k === 'constructor' || k === 'prototype';

const DAY = /^(\d{4})-(\d{2})-(\d{2})(T[0-9:.+\-Z]+)?$/;
/** 'YYYY-MM-DD' that is a real calendar day, optionally with a time (older entries). */
export function isEntryDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = DAY.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** A Firestore document id: no slash, not "." or "..", not __reserved__, at most 1,500 bytes. */
export function isEntryId(s: unknown): s is string {
  return typeof s === 'string' && s.length > 0 && s.length <= 300 && !s.includes('/')
    && s !== '.' && s !== '..' && !unsafeKey(s);
}

const TYPES = new Set<string>(Object.values(TransactionType));
const PAYEE_KINDS = new Set<PayeeKind>(['mine', 'family', 'investment', 'ignore', 'counts', 'salary']);
const CURRENCY = /^[A-Z]{3}$/;
/** Far above any real entry; guards against nonsense, not against big spenders. */
const MAX_AMOUNT = 1e12;

const text = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' ? v.slice(0, max) : undefined;

/** One entry rebuilt from a file's row, or null if it isn't one. */
export function asEntry(raw: unknown): Transaction | null {
  if (!isObject(raw)) return null;
  const { id, amount, type, date } = raw;
  if (!isEntryId(id)) return null;
  if (!isFiniteNumber(amount) || amount < 0 || amount > MAX_AMOUNT) return null;
  if (typeof type !== 'string' || !TYPES.has(type)) return null;
  if (!isEntryDate(date)) return null;

  const entry: Transaction = {
    id,
    amount,
    type: type as TransactionType,
    category: text(raw.category, 100)?.trim() || 'Uncategorized',
    date,
  };
  const note = text(raw.note, 2000);
  if (note !== undefined) entry.note = note;
  const merchant = text(raw.merchant, 300);
  if (merchant !== undefined) entry.merchant = merchant;
  const createdAt = text(raw.createdAt, 40);
  if (createdAt !== undefined) entry.createdAt = createdAt;

  const { typedAmount, typedCurrency } = raw;
  if (typedAmount !== undefined || typedCurrency !== undefined) {
    if (!isFiniteNumber(typedAmount) || typedAmount < 0 || typeof typedCurrency !== 'string' || !CURRENCY.test(typedCurrency)) return null;
    entry.typedAmount = typedAmount;
    entry.typedCurrency = typedCurrency;
  }
  return entry;
}

function readSettings(raw: unknown, version: number, legacyOpening: unknown): BackupSettings {
  const s: BackupSettings = {};
  if (version < 2 || !isObject(raw)) {
    if (isFiniteNumber(legacyOpening)) s.openingBalance = legacyOpening;
    return s;
  }
  if (isFiniteNumber(raw.openingBalance)) {
    s.openingBalance = raw.openingBalance;
    s.openingBalanceAsOf = isEntryDate(raw.openingBalanceAsOf) ? raw.openingBalanceAsOf.slice(0, 10) : null;
  }
  if (isObject(raw.budgets)) {
    const budgets: Record<string, number> = {};
    for (const [category, amount] of Object.entries(raw.budgets)) {
      const name = category.trim();
      if (!name || name.length > 100 || unsafeKey(name)) continue;
      if (isFiniteNumber(amount) && amount > 0 && amount <= MAX_AMOUNT) budgets[name] = amount;
    }
    if (Object.keys(budgets).length > 0) s.budgets = budgets;
  }
  if (isFiniteNumber(raw.savingsGoal) && raw.savingsGoal > 0 && raw.savingsGoal <= MAX_AMOUNT) s.savingsGoal = raw.savingsGoal;
  if (isFiniteNumber(raw.dailyLimit) && raw.dailyLimit > 0 && raw.dailyLimit <= MAX_AMOUNT) s.dailyLimit = raw.dailyLimit;
  if (Array.isArray(raw.payeeRules)) {
    const rules: PayeeRule[] = [];
    for (const r of raw.payeeRules) {
      if (!isObject(r) || !isEntryId(r.id) || typeof r.match !== 'string' || !PAYEE_KINDS.has(r.kind as PayeeKind)) continue;
      const match = r.match.trim().slice(0, 100);
      if (!match) continue;
      // A rule that counts may carry the category its payments show under.
      const category = r.kind === 'counts' && typeof r.category === 'string' && /^[A-Za-z][A-Za-z &]{0,39}$/.test(r.category)
        ? r.category : undefined;
      rules.push(category ? { id: r.id, match, kind: 'counts', category } : { id: r.id, match, kind: r.kind as PayeeKind });
    }
    if (rules.length > 0) s.payeeRules = rules;
  }
  return s;
}

export function hasSettings(s: BackupSettings): boolean {
  return (s.openingBalance !== undefined && (s.openingBalance !== 0 || !!s.openingBalanceAsOf))
    || !!s.budgets || !!s.savingsGoal || !!s.dailyLimit || !!s.payeeRules;
}

/** Reads a backup file's text. `limit` is for tests. */
export function readBackup(fileText: string, limit = MAX_BACKUP_CHARS): ReadResult {
  if (fileText.length > limit) return { ok: false, problem: 'too-big' };
  let data: unknown;
  try {
    data = JSON.parse(fileText);
  } catch {
    return { ok: false, problem: 'not-json' };
  }
  if (!isObject(data) || data.app !== BACKUP_APP || !Array.isArray(data.transactions)) {
    return { ok: false, problem: 'not-backup' };
  }
  const version = data.version;
  if (!isFiniteNumber(version) || !Number.isInteger(version) || version < 1) return { ok: false, problem: 'not-backup' };
  if (version > BACKUP_VERSION) return { ok: false, problem: 'newer-version' };

  const entries: Transaction[] = [];
  const ids = new Set<string>();
  let unreadable = 0;
  let repeated = 0;
  for (const row of data.transactions) {
    const entry = asEntry(row);
    if (!entry) { unreadable++; continue; }
    if (ids.has(entry.id)) { repeated++; continue; }
    ids.add(entry.id);
    entries.push(entry);
  }

  const settings = readSettings(data.settings, version, data.openingBalance);
  if (entries.length === 0 && !hasSettings(settings)) return { ok: false, problem: 'empty' };
  return {
    ok: true,
    backup: {
      version,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
      entries,
      unreadable,
      repeated,
      settings,
    },
  };
}

// ── What a restore will do ───────────────────────────────────────────────────

export interface RestorePlan {
  /** Entries the wallet doesn't have yet, in the file's order. */
  add: Transaction[];
  /** Entries the wallet already has (same id): skipped. */
  already: number;
  unreadable: number;
  repeated: number;
  /** The first and last day among the backup's entries. */
  from: string | null;
  to: string | null;
  exportedAt: string | null;
  settings: BackupSettings;
  hasSettings: boolean;
}

export function planRestore(backup: ReadBackup, walletIds: ReadonlySet<string>): RestorePlan {
  const add: Transaction[] = [];
  let already = 0;
  let from: string | null = null;
  let to: string | null = null;
  for (const t of backup.entries) {
    const day = t.date.slice(0, 10);
    if (from === null || day < from) from = day;
    if (to === null || day > to) to = day;
    if (walletIds.has(t.id)) already++;
    else add.push(t);
  }
  return {
    add,
    already,
    unreadable: backup.unreadable,
    repeated: backup.repeated,
    from,
    to,
    exportedAt: backup.exportedAt,
    settings: backup.settings,
    hasSettings: hasSettings(backup.settings),
  };
}

/** What the person sees when a file can't be restored. */
export const PROBLEM_TEXT: Record<BackupProblem, string> = {
  'too-big': "That file is far too large to be a Wall-ette backup.",
  'not-json': "That file isn't a Wall-ette backup. Choose the .json file that Full backup saved.",
  'not-backup': "That file isn't a Wall-ette backup. Choose the .json file that Full backup saved.",
  'newer-version': 'This backup was made by a newer version of Wall-ette. Update the app, then try again.',
  'empty': 'This backup has no entries or settings in it.',
};
