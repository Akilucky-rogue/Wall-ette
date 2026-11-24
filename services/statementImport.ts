// ═══════════════════════════════════════════════════════════════
// STATEMENT IMPORT — rows to transactions, and what the wallet already has
// ═══════════════════════════════════════════════════════════════
//
// A statement row is known by the bank's own reference for it, read from the
// narration: the 12-digit RRN on UPI and IMPS payments, the UTR on NEFT and
// RTGS. Rows without one (IFT, NACH, ATM, charges, interest) are known by
// their narration instead. With the date, direction and amount that gives one
// key per transaction, the same in the PDF and the Excel export. The import
// check, the import ids and Vault's duplicate cleaner all use it
// (audit L1–L3).

import { Transaction, TransactionType } from '../types';
import { addDays, byNewest } from '../utils/dates';
import { narrationFields } from './narration';

/** A row as the statement parsers return it. */
export interface StatementRow {
  date?: string;
  merchant?: string;
  amount?: number;
  type?: string;
  category?: string;
  note?: string;
}

/** The fields a transaction key is made from. */
export type KeyFields = Pick<Transaction, 'date' | 'type' | 'amount' | 'merchant' | 'note'>;

/** The Excel parser's rows, in the shape the PDF parser returns. */
export const fromExcel = (rows: any[]): StatementRow[] =>
  rows.map(t => ({
    date: t.date,
    merchant: (t.description || 'Unknown').substring(0, 100),
    amount: t.amount,
    type: t.type?.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE',
    category: t.category,
    note: t.notes || t.description,
  }));

// ── Bank references ─────────────────────────────────────────────────────────

const RRN = /^\d{12}$/;
// A UTR: 8 to 22 letters and digits, at least five of them digits.
const UTR = /^(?=(?:[A-Z]*\d){5})[A-Z0-9]{8,22}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * The bank's reference in a statement narration, or null when it has none.
 *   "UPI/DR/615230407557/ZOMATO L/UTIB/zomatoo/UPI"   → "rrn:615230407557"
 *   "IMPS-OPM/512345678901/Test Associates LLP/…"     → "rrn:512345678901"
 *   "NEFT/CMS123456789/ACME BROKING PVT LTD/ICIC…"    → "utr:CMS123456789"
 *   "UPI-ZOMATO LTD-zomato@axis-UTIB0000000-615230407557-PAY" (HDFC) → "rrn:…"
 *   "MB/NEFT/SRCB012345678901/NAME/" (Saraswat)       → "utr:SRCB012345678901"
 *   "IFT/10000123456/Mr. RAVI KUMAR SHAH/912345"      → null
 * Spaces are ignored: PDF narrations wrap mid-word, which can split one.
 */
export function bankReference(narration: string | undefined): string | null {
  if (!narration) return null;
  const segs = narrationFields(narration).map(f => f.toUpperCase().replace(/\s+/g, ''));
  if (segs.length === 0) return null;
  const rail = segs[0];
  if (/^(UPI|IMPS|MMT)/.test(rail)) {
    const rrn = segs.slice(1).find(s => RRN.test(s));
    return rrn ? `rrn:${rrn}` : null;
  }
  if (/^(NEFT|RTGS)/.test(rail)) {
    const utr = segs.slice(1).find(s => UTR.test(s) && !IFSC.test(s));
    return utr ? `utr:${utr}` : null;
  }
  return null;
}

/** The reference on a transaction: its narration, or the note when the payee was renamed. */
const referenceOf = (t: Pick<Transaction, 'merchant' | 'note'>): string | null =>
  bankReference(t.merchant) ?? bankReference(t.note);

// Letters and digits only, so the PDF's wrapped and the Excel export's cleaned
// narrations of a row compare equal. Both keep the first 100 characters of a
// narration, which can end at different places; 48 is well inside either.
const narrationText = (s: string | undefined): string =>
  (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);

const paise = (amount: number): number => Math.round(amount * 100);

/** One key per transaction: bank reference or narration, date, direction and amount. */
export function transactionKey(t: KeyFields): string {
  const ref = referenceOf(t) ?? `text:${narrationText(t.merchant)}`;
  return `${ref}|${t.date.slice(0, 10)}|${t.type}|${paise(t.amount)}`;
}

// ── Rows to transactions ────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Importing needs a secure (https) connection.');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** A day as statements give it: 'YYYY-MM-DD', and a real date. */
const isStatementDay = (d: unknown): d is string => {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  const probe = new Date(y, m - 1, day);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === day;
};

/**
 * Whether a parsed row can go into the wallet: a real day, a direction and an
 * amount above zero. A row without a narration still can (it's kept as
 * "Unknown", as the Excel reader names it), so no money goes missing.
 */
export const importable = (t: StatementRow): boolean =>
  isStatementDay(t.date) &&
  (t.type === 'INCOME' || t.type === 'EXPENSE') &&
  typeof t.amount === 'number' && Number.isFinite(t.amount) && t.amount > 0;

/**
 * Rows with money on them that can't be imported (no readable day or
 * direction, or an amount below zero). Import says how many, so a statement
 * is never short without the person knowing.
 */
export const unreadableRows = (rows: readonly StatementRow[]): number =>
  rows.filter(t => !importable(t) && !(t.amount === 0)).length;

/**
 * The importable rows as wallet transactions, amounts to the paisa. A row's
 * id is a SHA-256 hash of its key, so it's the same in every statement that
 * has the row; identical rows in one statement are numbered in order (audit L2).
 */
export async function toTransactions(rows: readonly StatementRow[]): Promise<Transaction[]> {
  const valid: Omit<Transaction, 'id'>[] = [];
  for (const t of rows) {
    if (!importable(t)) continue;
    valid.push({
      date: t.date!,
      merchant: t.merchant?.trim() || 'Unknown',
      amount: Math.round(t.amount! * 100) / 100,
      type: t.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
      category: t.category?.trim() || 'Uncategorized',
      note: t.note?.trim() || '',
    });
  }
  const seen = new Map<string, number>();
  const names = valid.map(t => {
    const key = transactionKey(t);
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return `${key}#${n}`;
  });
  const hashes = await Promise.all(names.map(sha256Hex));
  return valid.map((t, i) => ({ id: `import-${hashes[i].slice(0, 32)}`, ...t }));
}

/** Ids toTransactions gives (from 1.5.4); earlier imports have shorter, decimal ones. */
export const STABLE_ID = /^import-[0-9a-f]{32}$/;

/**
 * Imported rows that are in the wallet more than once, leaving out the copy
 * of each to keep (audit L3). Rows group by transactionKey, so a PDF and an
 * Excel copy of a row match. Entries typed in New Entry are left alone: two
 * identical ones can both be real. Rows with stable ids are all real too:
 * identical rows in a statement get different ones, and an import skips ids
 * the wallet has. So when a group has any, only its older rows are copies.
 */
export function walletCopies(transactions: readonly Transaction[]): { copies: Transaction[]; groups: number } {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.id.startsWith('import-')) continue;
    const key = transactionKey(t);
    const g = groups.get(key);
    if (g) g.push(t);
    else groups.set(key, [t]);
  }
  const copies: Transaction[] = [];
  let count = 0;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const older = g.filter(t => !STABLE_ID.test(t.id));
    const extra = older.length === g.length ? older.slice(1) : older;
    if (extra.length === 0) continue;
    count++;
    copies.push(...extra);
  }
  return { copies, groups: count };
}

// ── What the wallet already has ─────────────────────────────────────────────

interface Entry {
  ref: string | null;
  text: string;
  /** Letters only, so reference and account numbers don't count. */
  loose: string;
  hasPayee: boolean;
  used: boolean;
}

const entryOf = (t: Transaction): Entry => ({
  ref: referenceOf(t),
  text: narrationText(t.merchant),
  loose: (t.merchant || '').toLowerCase().replace(/[^a-z]/g, ''),
  hasPayee: !!t.merchant,
  used: false,
});

const bucketKey = (t: Transaction): string => `${t.date.slice(0, 10)}|${t.type}|${paise(t.amount)}`;

// Two references, where both rows have one, must be the same.
const refsAgree = (a: string | null, b: string | null): boolean => !a || !b || a === b;

// One narration contains the other, as when an entry typed in New Entry
// ("Swiggy") later arrives in a statement ("UPI/DR/…/SWIGGY/…").
const looselyMatch = (a: string, b: string): boolean =>
  a === b || (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a)));

/**
 * Ids of the incoming transactions the wallet already has. Each wallet entry
 * stands for one incoming row at most, so two real ₹249 payments on one day
 * stay new when the wallet has only one. Matches need the same date, direction
 * and amount, then, strongest first across the whole statement:
 *   1. the same bank reference;
 *   2. the same narration;
 *   3. one narration containing the other, or a wallet entry with no payee.
 * Rows whose references differ never match (audit L1).
 */
export function findDuplicates(
  incoming: readonly Transaction[],
  existing: readonly Transaction[],
): Set<string> {
  const buckets = new Map<string, Entry[]>();
  for (const t of existing) {
    const key = bucketKey(t);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = []));
    bucket.push(entryOf(t));
  }

  const rows = incoming
    .map(t => ({ id: t.id, entry: entryOf(t), bucket: buckets.get(bucketKey(t)) }))
    .filter(r => r.bucket);
  const found = new Set<string>();
  const claim = (pass: (row: Entry, wallet: Entry) => boolean) => {
    for (const r of rows) {
      if (found.has(r.id)) continue;
      const match = r.bucket!.find(w => !w.used && pass(r.entry, w));
      if (match) {
        match.used = true;
        found.add(r.id);
      }
    }
  };
  claim((row, w) => row.ref !== null && w.ref === row.ref);
  claim((row, w) => refsAgree(row.ref, w.ref) && w.text === row.text);
  claim((row, w) => refsAgree(row.ref, w.ref) && (!w.hasPayee || looselyMatch(row.loose, w.loose)));
  return found;
}

// ── Into the wallet ─────────────────────────────────────────────────────────

/** What importing works on: the entries and the balance they start from. */
export interface WalletLedger {
  transactions: readonly Transaction[];
  openingBalance: number;
  /** The first day of the earliest statement imported, or null. */
  openingBalanceAsOf: string | null;
}

export interface MergeResult {
  /** All entries after the import, newest first. */
  transactions: Transaction[];
  /** The rows that went in (not ones the wallet already had). */
  added: Transaction[];
  /** Ids taken out (stale balance adjustments). */
  removed: string[];
  /** The new opening balance, when this statement is now the earliest. */
  opening: { balance: number; asOf: string | null } | null;
}

/**
 * The wallet after an import, worked out in one step from one list, so
 * nothing is lost between taking out stale adjustments and adding rows.
 *   - rows with an id the wallet has (the same row from another statement)
 *     are left out, as are repeats within the import;
 *   - the balance anchors to the earliest statement ever imported: its
 *     opening balance applies when it starts before the current anchor (or,
 *     for wallets from before anchors, before every entry), so
 *     balance = opening + every entry, in whatever order statements arrive.
 */
export function mergeImport(
  wallet: WalletLedger,
  incoming: readonly Transaction[],
  options: { opening?: number; statementStart?: string; removeIds?: Iterable<string> } = {},
): MergeResult {
  const remove = new Set(options.removeIds ?? []);
  const base = wallet.transactions.filter(t => !remove.has(t.id));
  const removed = wallet.transactions.filter(t => remove.has(t.id)).map(t => t.id);
  const ids = new Set(base.map(t => t.id));
  const added: Transaction[] = [];
  for (const t of incoming) {
    if (ids.has(t.id)) continue;
    ids.add(t.id);
    added.push(t);
  }

  let opening: MergeResult['opening'] = null;
  const { opening: statementOpening, statementStart } = options;
  if (statementOpening !== undefined && Number.isFinite(statementOpening) && added.length > 0) {
    let applies = false;
    if (base.length === 0) applies = true;
    else if (wallet.openingBalanceAsOf) applies = !!statementStart && statementStart < wallet.openingBalanceAsOf;
    else if (statementStart) applies = base.every(t => statementStart <= t.date.slice(0, 10));
    if (applies) opening = { balance: statementOpening, asOf: statementStart ?? null };
  }

  return {
    transactions: added.length || removed.length ? [...added, ...base].sort(byNewest) : [...wallet.transactions],
    added,
    removed,
    opening,
  };
}

/** Money in minus money out, counted in paise so sums are exact. */
export const netPaise = (list: readonly Pick<Transaction, 'amount' | 'type'>[]): number =>
  list.reduce((s, t) => s + (t.type === TransactionType.INCOME ? 1 : -1) * Math.round(t.amount * 100), 0);

/** The wallet's balance: opening plus every entry (all of them, counted or not). */
export const ledgerBalance = (wallet: WalletLedger): number =>
  (Math.round(wallet.openingBalance * 100) + netPaise(wallet.transactions)) / 100;

const ADJUST_ID = /^adjust-(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})-/;

/**
 * Balance adjustments that stood in for a missing statement period this
 * statement now covers (any part of it). The adjustment's id names the
 * period: the last day covered before and the first day covered after.
 */
export function staleAdjustments(existing: readonly Transaction[], from: string, to: string): string[] {
  return existing
    .filter(t => {
      if (!t.id.startsWith('adjust-')) return false;
      const m = ADJUST_ID.exec(t.id);
      if (m) return from < m[2] && to > m[1];
      const day = t.date.slice(0, 10); // an adjustment from an older version
      return day >= from && day <= to;
    })
    .map(t => t.id);
}

/** A run of days with no statement, and the money it moved. */
export interface CoverageGap {
  amount: number;
  /** Last day covered before the gap. */
  from: string;
  /** First day covered after it. */
  to: string;
  /** The day the adjustment is entered on: the first missing day, so the
   *  balance on either statement's own last day leaves it out. */
  at: string;
  direction: 'after' | 'before';
}

/** One entry that stands in for a missing statement period. */
export const bridgeAdjustment = (g: CoverageGap): Transaction => ({
  id: `adjust-${g.from}-${g.to}-${Math.round(Math.abs(g.amount) * 100)}`,
  date: g.at,
  merchant: 'Balance adjustment — missing statement period',
  amount: Math.round(Math.abs(g.amount) * 100) / 100,
  type: g.amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
  category: 'Adjustment',
  note: `Bridges un-imported period ${g.from} → ${g.to}. Delete this if you import that statement later.`,
});

export interface ImportTally {
  /** The wallet's balance at the statement's last day, after the import. */
  projected: number;
  /** The wallet's balance after the import, counting later entries too. */
  projectedFinal: number;
  hasNewer: boolean;
  endDate: string;
  closing: number;
  diff: number;
  /** The same to the paisa. */
  matched: boolean;
  isNewest: boolean;
  gap: CoverageGap | null;
  /** Adjustments the import takes out, because this statement covers their period. */
  stale: string[];
}

/**
 * The balance check on Import's review: the wallet as the import will leave
 * it (worked out with mergeImport itself, so the check and the import can't
 * disagree) against the statement's closing balance, both at the statement's
 * last day. Also finds a gap between this statement and the wallet's entries,
 * whichever side it's on, and the adjustment that would bridge it.
 */
export function importTally(args: {
  wallet: WalletLedger;
  selected: readonly Transaction[];
  /** All rows in the statement (their first and last day). */
  minDate: string;
  maxDate: string;
  opening?: number;
  closing?: number;
  bridge: boolean;
}): ImportTally | null {
  const { wallet, selected, minDate, maxDate, opening, closing, bridge } = args;
  if (closing === undefined || !Number.isFinite(closing)) return null;
  const days = wallet.transactions.map(t => t.date.slice(0, 10));
  const latest = days.length ? days.reduce((a, b) => (b > a ? b : a)) : null;
  const earliest = days.length ? days.reduce((a, b) => (b < a ? b : a)) : null;
  const balance = ledgerBalance(wallet);
  const paise = (n: number) => Math.round(n * 100);

  let gap: CoverageGap | null = null;
  if (opening !== undefined && latest && minDate > latest) {
    const amount = (paise(opening) - paise(balance)) / 100;
    if (paise(amount) !== 0) gap = { amount, from: latest, to: minDate, at: addDays(latest, 1), direction: 'after' };
  } else if (earliest && maxDate < earliest && wallet.openingBalanceAsOf) {
    const amount = (paise(wallet.openingBalance) - paise(closing)) / 100;
    if (paise(amount) !== 0) gap = { amount, from: maxDate, to: wallet.openingBalanceAsOf.slice(0, 10), at: addDays(maxDate, 1), direction: 'before' };
  }

  const stale = staleAdjustments(wallet.transactions, minDate, maxDate);
  const incoming = bridge && gap ? [bridgeAdjustment(gap), ...selected] : [...selected];
  const after = mergeImport(wallet, incoming, { opening, statementStart: minDate, removeIds: stale });
  const afterLedger: WalletLedger = {
    transactions: after.transactions,
    openingBalance: after.opening ? after.opening.balance : wallet.openingBalance,
    openingBalanceAsOf: after.opening ? after.opening.asOf : wallet.openingBalanceAsOf,
  };
  const projectedFinal = ledgerBalance(afterLedger);
  const later = after.transactions.filter(t => t.date.slice(0, 10) > maxDate);
  const projected = (paise(projectedFinal) - netPaise(later)) / 100;
  const diff = (paise(projected) - paise(closing)) / 100;
  return {
    projected,
    projectedFinal,
    hasNewer: later.length > 0,
    endDate: maxDate,
    closing,
    diff,
    matched: paise(diff) === 0,
    isNewest: !latest || maxDate >= latest,
    gap,
    stale,
  };
}
