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

/**
 * The valid rows as wallet transactions. A row's id is a SHA-256 hash of its
 * key, so it's the same in every statement that has the row; identical rows
 * in one statement are numbered in order (audit L2).
 */
export async function toTransactions(rows: readonly StatementRow[]): Promise<Transaction[]> {
  const valid: Omit<Transaction, 'id'>[] = [];
  for (const t of rows) {
    if (!t.date || !t.amount || !t.type || !t.merchant) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    if (typeof t.amount !== 'number' || t.amount <= 0) continue;
    if (t.type !== 'INCOME' && t.type !== 'EXPENSE') continue;
    valid.push({
      date: t.date,
      merchant: t.merchant.trim(),
      amount: Math.abs(t.amount),
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
