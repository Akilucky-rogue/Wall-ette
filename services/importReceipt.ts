// ═══════════════════════════════════════════════════════════════
// IMPORT RECEIPTS — what each statement import did
// ═══════════════════════════════════════════════════════════════
//
// The audits found nothing recorded what an import did. Each import now
// leaves a receipt: the statement's period, the rows read, what was added,
// what was skipped and why, and how the balance check read. The last
// MAX_RECEIPTS are kept with the account's settings (and on this device),
// and the Import screen lists them. A receipt holds counts and the check's
// balances only: no payees, narrations or file names (a file name can carry
// an account number).
//
// No React or Firebase imports, so the check scripts run it in Node.

export type ReceiptCheck = 'ok' | 'note' | 'off';

export interface ImportReceipt {
  id: string;
  /** When the import ran, ISO. */
  at: string;
  /** The bank the reader recognised, or null for the general reader. */
  bank: string | null;
  format: 'PDF' | 'Excel';
  /** The statement's first and last day, YYYY-MM-DD. */
  from: string;
  to: string;
  /** Rows with money on them that were read. */
  rows: number;
  /** Entries added to the wallet. */
  added: number;
  /** Rows the wallet already had, skipped. */
  duplicates: number;
  /** Rows left unticked on the review that the wallet doesn't have. */
  leftOut: number;
  /** Rows with money on them the reader couldn't place (no day or direction). */
  unreadable: number;
  /** Balance adjustments this statement replaced. */
  replaced: number;
  /** An adjustment was added to bridge a gap before or after the statement. */
  bridged: boolean;
  /**
   * The balance check: 'ok' when the wallet matched the bank's closing
   * balance, 'note' when the statement checked out row for row but the
   * wallet holds more than this account, 'off' when it didn't add up; null
   * when the statement printed no closing balance.
   */
  check: ReceiptCheck | null;
  /** The bank's closing balance on `to`, in rupees. */
  closing?: number;
  /** The wallet's balance on `to` minus the bank's, in rupees (0 when it matched). */
  difference?: number;
  /** Money out this import left "To review", in rupees. */
  toReview?: number;
}

export const MAX_RECEIPTS = 20;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const count = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1e7;
const money = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12;

/** Receipts as saved (settings or this device), newest first; anything malformed is dropped. */
export function asImportReceipts(raw: unknown): ImportReceipt[] {
  if (!Array.isArray(raw)) return [];
  const out: ImportReceipt[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>;
    if (typeof x.id !== 'string' || x.id.length > 80 || typeof x.at !== 'string' || Number.isNaN(Date.parse(x.at))) continue;
    if (typeof x.from !== 'string' || !DAY.test(x.from) || typeof x.to !== 'string' || !DAY.test(x.to)) continue;
    if (x.format !== 'PDF' && x.format !== 'Excel') continue;
    if (![x.rows, x.added, x.duplicates, x.leftOut, x.unreadable, x.replaced].every(count)) continue;
    const check = x.check === 'ok' || x.check === 'note' || x.check === 'off' ? x.check : null;
    const receipt: ImportReceipt = {
      id: x.id, at: x.at,
      bank: typeof x.bank === 'string' && x.bank.length <= 60 ? x.bank : null,
      format: x.format, from: x.from, to: x.to,
      rows: x.rows as number, added: x.added as number, duplicates: x.duplicates as number,
      leftOut: x.leftOut as number, unreadable: x.unreadable as number, replaced: x.replaced as number,
      bridged: x.bridged === true, check,
    };
    if (money(x.closing)) receipt.closing = x.closing;
    if (money(x.difference)) receipt.difference = x.difference;
    if (money(x.toReview) && x.toReview > 0) receipt.toReview = x.toReview;
    out.push(receipt);
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, MAX_RECEIPTS);
}

/** The list with `receipt` added as the newest, keeping MAX_RECEIPTS. */
export const withReceipt = (list: readonly ImportReceipt[], receipt: ImportReceipt): ImportReceipt[] =>
  [receipt, ...list.filter(r => r.id !== receipt.id)].slice(0, MAX_RECEIPTS);

/** "Added 412 of 431 rows", then what happened to the rest, as short clauses. */
export function receiptLines(r: ImportReceipt): string[] {
  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
  const lines = [`Added ${r.added.toLocaleString('en-IN')} of ${plural(r.rows, 'row')}`];
  if (r.duplicates > 0) lines.push(`${plural(r.duplicates, 'row')} already in your wallet, skipped`);
  if (r.leftOut > 0) lines.push(`${plural(r.leftOut, 'row')} left out on the review`);
  if (r.unreadable > 0) lines.push(`${plural(r.unreadable, 'row')} couldn't be read`);
  if (r.replaced > 0) lines.push(`${plural(r.replaced, 'balance adjustment')} replaced by this statement`);
  if (r.bridged) lines.push('A balance adjustment bridges a gap with no statement');
  return lines;
}
