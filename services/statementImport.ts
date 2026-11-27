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
import { type AccountAnchor, type AccountAnchors, accountKey, totalOpening } from './accounts';

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
 * stay new when the wallet has only one. First, a row the wallet has under
 * its own id (the same statement line, imported before, even if edited since)
 * claims that entry, so an identical line beside it in the statement (its id
 * numbered #2) isn't taken for it and stays new. The rest match on the same
 * date, direction and amount, then, strongest first across the whole statement:
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
  const byId = new Map<string, Entry>();
  for (const t of existing) {
    const key = bucketKey(t);
    let bucket = buckets.get(key);
    if (!bucket) buckets.set(key, (bucket = []));
    const entry = entryOf(t);
    bucket.push(entry);
    byId.set(t.id, entry);
  }

  const found = new Set<string>();
  for (const t of incoming) {
    const own = byId.get(t.id);
    if (own && !own.used) {
      own.used = true;
      found.add(t.id);
    }
  }

  const rows = incoming
    .filter(t => !found.has(t.id))
    .map(t => ({ id: t.id, entry: entryOf(t), bucket: buckets.get(bucketKey(t)) }))
    .filter(r => r.bucket);
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
  /**
   * The opening balance not tied to an account: from wallets before 1.5.9,
   * when accounts weren't told apart, and from statements that don't show
   * their account number.
   */
  openingBalance: number;
  /** The first day of the earliest such statement, or null. */
  openingBalanceAsOf: string | null;
  /** Each account's own opening balance (from 1.5.9), by accountKey. */
  accounts?: AccountAnchors;
}

/** The account a statement is from, and, when that's open, how it joins the wallet. */
export interface StatementAccount {
  bank: string;
  last4: string;
  /**
   * For an account the wallet doesn't know yet, in a wallet that still has
   * an opening balance from before accounts: whether that balance and the
   * entries imported then are this account's ('same', the default) or
   * another account's ('separate').
   */
  legacy?: 'same' | 'separate';
}

export interface MergeResult {
  /** All entries after the import, newest first. */
  transactions: Transaction[];
  /** The rows that went in (not ones the wallet already had). */
  added: Transaction[];
  /**
   * Entries the wallet already had from this statement, imported before
   * 1.5.9 told accounts apart, now marked with its account.
   */
  retagged: Transaction[];
  /** Ids taken out (stale balance adjustments). */
  removed: string[];
  /** The new opening balance not tied to an account, when it changed. */
  opening: { balance: number; asOf: string | null } | null;
  /** The statement's account after the import, when it's new or its opening balance changed. */
  account: { key: string; anchor: AccountAnchor } | null;
}

/** The wallet still has an opening balance from before accounts. */
const hasUnassigned = (w: WalletLedger): boolean => w.openingBalance !== 0 || w.openingBalanceAsOf !== null;

/** A statement being imported: every row read from it, and its first and last day. */
export interface StatementRows {
  rows: readonly Transaction[];
  from: string;
  to: string;
}

/**
 * The account's own part of the wallet: its entries and its opening balance,
 * as if it were the only account. The balance check and the gap between
 * statements are worked out on this, so another account's entries never
 * read as this one's missing money. Entries typed in (createdAt) are left
 * out. Imported entries from before 1.5.9 (no account) are the account's
 * when they're rows of this statement, or when the account takes over the
 * opening balance from then, from the day that balance is from; but not,
 * even then, ones inside the statement's own period that aren't its rows: a
 * statement has every row of its period, so those are another account's.
 * Without an account (a statement that doesn't show its number), it's the
 * entries no account claims and the opening balance from before accounts.
 */
export function accountView(wallet: WalletLedger, account: StatementAccount | undefined, statement?: StatementRows): WalletLedger {
  if (!account) {
    // A statement that doesn't show its number: everything no account claims.
    if (!wallet.transactions.some(t => t.account) && Object.keys(wallet.accounts ?? {}).length === 0) return wallet;
    return {
      transactions: wallet.transactions.filter(t => !t.account),
      openingBalance: wallet.openingBalance,
      openingBalanceAsOf: wallet.openingBalanceAsOf,
    };
  }
  const key = accountKey(account.bank, account.last4);
  const known = wallet.accounts?.[key];
  const adopts = !known && hasUnassigned(wallet) && account.legacy !== 'separate';
  const old = known ? !!known.legacy : adopts;
  // The day its opening balance is from: entries from before 1.5.9 dated
  // earlier aren't its own (that balance already counts them).
  const asOf = (known ? known.asOf : adopts ? wallet.openingBalanceAsOf : null)?.slice(0, 10) ?? null;
  const untagged = wallet.transactions.filter(t => !t.account && !t.createdAt);
  const fromThen = (t: Transaction) => !asOf || t.date.slice(0, 10) >= asOf;
  let mine: ReadonlySet<string> = new Set();
  if (statement && untagged.length > 0) {
    const from = statement.from.slice(0, 10);
    const to = statement.to.slice(0, 10);
    const ids = new Set(statement.rows.map(t => t.id));
    const inPeriod = untagged.filter(t => !ids.has(t.id) && t.date.slice(0, 10) >= from && t.date.slice(0, 10) <= to);
    const matched = findDuplicates(inPeriod, statement.rows);
    mine = new Set([...untagged.filter(t => ids.has(t.id)).map(t => t.id), ...matched]);
    if (old) {
      // Inside the period, only the statement's rows.
      const others = new Set(inPeriod.filter(t => !matched.has(t.id) && !t.id.startsWith('adjust-')).map(t => t.id));
      mine = new Set(untagged.filter(t => mine.has(t.id) || (!others.has(t.id) && fromThen(t))).map(t => t.id));
    }
  } else if (old) {
    mine = new Set(untagged.filter(fromThen).map(t => t.id));
  }
  return {
    transactions: wallet.transactions.filter(t => t.account === key || mine.has(t.id)),
    openingBalance: known ? known.opening : adopts ? wallet.openingBalance : 0,
    openingBalanceAsOf: known ? known.asOf : adopts ? wallet.openingBalanceAsOf : null,
  };
}

/**
 * Whether the opening balance a wallet kept from before 1.5.9 (when
 * accounts weren't told apart) is this statement's account's ('same') or
 * another account's ('separate'), as far as the wallet shows, for a
 * statement from an account the wallet doesn't know yet. In order:
 *   1. the statement covers the day that balance is from: its own balance
 *      that day says whose it is;
 *   2. it closes, before that day, at that balance;
 *   3. it opens where that balance and the entries before it leave off;
 *   4. entries from then run alongside it that aren't its rows: another
 *      account's, so the balance may be too;
 * else 'same' (a wallet that has only ever had one account). Review shows
 * the choice, so it can be changed. Null when there's nothing to decide: a
 * known account, or no opening balance from before 1.5.9.
 */
export function suggestLegacy(args: {
  wallet: WalletLedger;
  account: Pick<StatementAccount, 'bank' | 'last4'>;
  /** Every row read from the statement. */
  rows: readonly Transaction[];
  minDate: string;
  maxDate: string;
  opening?: number;
  closing?: number;
}): 'same' | 'separate' | null {
  const { wallet, account, rows, minDate, maxDate, opening, closing } = args;
  if (wallet.accounts?.[accountKey(account.bank, account.last4)] || !hasUnassigned(wallet)) return null;
  const old = wallet.transactions.filter(t => !t.account && !t.createdAt);
  const start = minDate.slice(0, 10);
  const end = maxDate.slice(0, 10);
  const asOf = wallet.openingBalanceAsOf?.slice(0, 10) ?? null;
  const was = paise(wallet.openingBalance);
  const opens = opening !== undefined && Number.isFinite(opening);
  if (asOf && opens && start <= asOf && asOf <= end) {
    const thatDay = paise(opening!) + netPaise(rows.filter(t => t.date.slice(0, 10) < asOf));
    return thatDay === was ? 'same' : 'separate';
  }
  if (asOf && closing !== undefined && Number.isFinite(closing) && end < asOf && paise(closing) === was) return 'same';
  if (opens && was + netPaise(old.filter(t => t.date.slice(0, 10) < start)) === paise(opening!)) return 'same';
  const its = findDuplicates(old, rows);
  const alongside = old.some(t => {
    const day = t.date.slice(0, 10);
    return !t.id.startsWith('adjust-') && !its.has(t.id) && day >= start && day <= end;
  });
  return alongside ? 'separate' : 'same';
}

/**
 * The wallet after an import, worked out in one step from one list, so
 * nothing is lost between taking out stale adjustments and adding rows.
 *   - rows with an id the wallet has (the same row from another statement)
 *     are left out, as are repeats within the import;
 *   - a statement from a known account (options.account) anchors that
 *     account's opening balance to its earliest statement; an account the
 *     wallet doesn't know adds its own opening balance, or takes over the
 *     opening balance from before 1.5.9 (account.legacy), even when every
 *     row is one the wallet already has, so importing a statement again
 *     sets an opening balance that was missing; new rows carry the account,
 *     and so do the statement's rows the wallet had with none (imported
 *     before 1.5.9), so each account's entries are its own from then on;
 *   - with no account (the statement doesn't show its number), the balance
 *     anchors to the earliest such statement, as before 1.5.9: its opening
 *     balance applies when it starts before the current anchor (or, for
 *     wallets from before anchors, before every entry no account claims);
 * so balance = every opening + every entry, in whatever order statements arrive.
 */
export function mergeImport(
  wallet: WalletLedger,
  incoming: readonly Transaction[],
  options: {
    opening?: number;
    statementStart?: string;
    removeIds?: Iterable<string>;
    account?: StatementAccount;
    /** Every row read from the statement, ticked or not: the wallet's
     *  entries among them that have no account yet are marked with this one. */
    rowIds?: Iterable<string>;
  } = {},
): MergeResult {
  const remove = new Set(options.removeIds ?? []);
  const key = options.account ? accountKey(options.account.bank, options.account.last4) : null;
  const statementRows = new Set([...(options.rowIds ?? []), ...incoming.map(t => t.id)]);
  const retagged: Transaction[] = [];
  const base = wallet.transactions.filter(t => !remove.has(t.id)).map(t => {
    if (!key || t.account || t.createdAt || !statementRows.has(t.id)) return t;
    const own = { ...t, account: key };
    retagged.push(own);
    return own;
  });
  const removed = wallet.transactions.filter(t => remove.has(t.id)).map(t => t.id);
  const ids = new Set(base.map(t => t.id));
  const added: Transaction[] = [];
  for (const t of incoming) {
    if (ids.has(t.id)) continue;
    ids.add(t.id);
    added.push(key && !t.account ? { ...t, account: key } : t);
  }

  let opening: MergeResult['opening'] = null;
  let account: MergeResult['account'] = null;
  const { opening: statementOpening, statementStart } = options;
  const known = statementOpening !== undefined && Number.isFinite(statementOpening);
  if (options.account && key) {
    const { bank, last4 } = options.account;
    let anchor: AccountAnchor | null = wallet.accounts?.[key] ? { ...wallet.accounts[key] } : null;
    let changed = false;
    if (!anchor && hasUnassigned(wallet) && options.account.legacy !== 'separate') {
      // This account takes over the opening balance from before accounts.
      anchor = { bank, last4, opening: wallet.openingBalance, asOf: wallet.openingBalanceAsOf, legacy: true };
      opening = { balance: 0, asOf: null };
      changed = true;
    }
    if (known) {
      if (!anchor) {
        anchor = { bank, last4, opening: statementOpening, asOf: statementStart ?? null };
        changed = true;
      } else {
        const own = base.filter(t => t.account === key || (anchor!.legacy && !t.account && !t.createdAt));
        const earliest = anchor.asOf
          ? !!statementStart && statementStart < anchor.asOf
          : !!statementStart && own.every(t => statementStart <= t.date.slice(0, 10));
        if (earliest) {
          anchor = { ...anchor, opening: statementOpening, asOf: statementStart ?? null };
          changed = true;
        }
      }
    }
    if (changed && anchor) account = { key, anchor };
  } else if (known && added.length > 0) {
    // Entries of known accounts count from their own openings: only the
    // rest decide whether this one is the earliest.
    const rest = base.filter(t => !t.account);
    let applies = false;
    if (rest.length === 0) applies = true;
    else if (wallet.openingBalanceAsOf) applies = !!statementStart && statementStart < wallet.openingBalanceAsOf;
    else if (statementStart) applies = rest.every(t => statementStart <= t.date.slice(0, 10));
    if (applies) opening = { balance: statementOpening, asOf: statementStart ?? null };
  }

  return {
    transactions: added.length || removed.length || retagged.length ? [...added, ...base].sort(byNewest) : [...wallet.transactions],
    added,
    retagged,
    removed,
    opening,
    account,
  };
}

/** The wallet after a merge: its entries, and its opening balances with the merge's changes. */
export const afterMerge = (wallet: WalletLedger, r: MergeResult): WalletLedger => ({
  transactions: r.transactions,
  openingBalance: r.opening ? r.opening.balance : wallet.openingBalance,
  openingBalanceAsOf: r.opening ? r.opening.asOf : wallet.openingBalanceAsOf,
  accounts: r.account ? { ...(wallet.accounts ?? {}), [r.account.key]: r.account.anchor } : wallet.accounts,
});

/** Money in minus money out, counted in paise so sums are exact. */
export const netPaise = (list: readonly Pick<Transaction, 'amount' | 'type'>[]): number =>
  list.reduce((s, t) => s + (t.type === TransactionType.INCOME ? 1 : -1) * Math.round(t.amount * 100), 0);

/** The wallet's balance: every opening balance plus every entry (all of them, counted or not). */
export const ledgerBalance = (wallet: WalletLedger): number =>
  (Math.round(totalOpening(wallet.openingBalance, wallet.accounts) * 100) + netPaise(wallet.transactions)) / 100;

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

/**
 * The statement checked on its own: the rows read from it against its own
 * opening and closing balances, and whether the import puts every row in the
 * wallet exactly once. This is what proves an import right in a wallet that
 * also holds other accounts or cash, whose total can't equal one account's.
 */
export interface StatementCheck {
  /** Opening + every row read = closing, to the paisa. */
  addsUp: boolean;
  /** Closing − (opening + every row read): money the rows don't account for. */
  unexplained: number;
  /** Unticked rows the wallet doesn't have: the import would leave them out. */
  leftOut: { count: number; net: number };
  /** Ticked rows the wallet already has under another id: they'd count twice. */
  twice: { count: number; net: number };
  /** Adds up, and every row ends up in the wallet exactly once. */
  complete: boolean;
}

/** The statement's own check; null when it doesn't print both balances. */
export function statementCheck(args: {
  /** Every row read from the statement, ticked or not. */
  rows: readonly Transaction[];
  selectedIds: ReadonlySet<string>;
  /** Rows the wallet already has (findDuplicates). */
  duplicateIds: ReadonlySet<string>;
  walletIds: ReadonlySet<string>;
  opening?: number;
  closing?: number;
}): StatementCheck | null {
  const { rows, selectedIds, duplicateIds, walletIds, opening, closing } = args;
  if (opening === undefined || closing === undefined || !Number.isFinite(opening) || !Number.isFinite(closing)) return null;
  // A row with an id the wallet has is skipped by mergeImport, ticked or not.
  const leftOut = rows.filter(t => !selectedIds.has(t.id) && !duplicateIds.has(t.id) && !walletIds.has(t.id));
  const twice = rows.filter(t => selectedIds.has(t.id) && duplicateIds.has(t.id) && !walletIds.has(t.id));
  const unexplained = paise(closing) - paise(opening) - netPaise(rows);
  const total = (list: Transaction[]) => ({ count: list.length, net: netPaise(list) / 100 });
  return {
    addsUp: unexplained === 0,
    unexplained: unexplained / 100,
    leftOut: total(leftOut),
    twice: total(twice),
    complete: unexplained === 0 && leftOut.length === 0 && twice.length === 0,
  };
}

export interface ImportTally {
  /** The account's balance at the statement's last day, after the import. */
  projected: number;
  /** The wallet's balance after the import (every account), counting later entries too. */
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
  /** The statement's own check (needs `rows`, and both balances printed). */
  statement: StatementCheck | null;
  /** The account's opening balance after the import, when the import sets or moves it. */
  accountOpening: { key: string; anchor: AccountAnchor; isNew: boolean } | null;
}

/**
 * The balance check on Import's review: the statement's account as the
 * import will leave it (worked out with mergeImport itself, so the check and
 * the import can't disagree) against the statement's closing balance, both
 * at the statement's last day. With the account known (from 1.5.9), that's
 * the account's own entries and opening balance, so a wallet with several
 * accounts checks each one; without it, the whole wallet, as before. Also
 * finds a gap between this statement and the account's entries, whichever
 * side it's on, and the adjustment that would bridge it. Given the
 * statement's rows, it checks the statement on its own too.
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
  /** Every row read from the statement, ticked or not, and the ones the
   *  wallet already has: for the statement's own check. */
  rows?: readonly Transaction[];
  duplicates?: ReadonlySet<string>;
  /** The statement's account, when it shows its number. */
  account?: StatementAccount;
  /**
   * Entries read from payment apps that ticked rows take the place of
   * (services/captured.ts capturedRows): out of the wallet in the same step.
   */
  replaces?: readonly string[];
}): ImportTally | null {
  const { wallet, selected, minDate, maxDate, opening, closing, bridge, account } = args;
  const replaces = args.replaces ?? [];
  if (closing === undefined || !Number.isFinite(closing)) return null;
  const rows = args.rows ?? selected;
  const rowIds = new Set(rows.map(t => t.id));
  const statement: StatementRows = { rows, from: minDate, to: maxDate };
  const view = accountView(wallet, account, statement);
  const days = view.transactions.map(t => t.date.slice(0, 10));
  const latest = days.length ? days.reduce((a, b) => (b > a ? b : a)) : null;
  const earliest = days.length ? days.reduce((a, b) => (b < a ? b : a)) : null;
  const balance = ledgerBalance(view);
  const paise = (n: number) => Math.round(n * 100);

  let gap: CoverageGap | null = null;
  if (opening !== undefined && latest && minDate > latest) {
    const amount = (paise(opening) - paise(balance)) / 100;
    if (paise(amount) !== 0) gap = { amount, from: latest, to: minDate, at: addDays(latest, 1), direction: 'after' };
  } else if (earliest && maxDate < earliest && view.openingBalanceAsOf) {
    const amount = (paise(view.openingBalance) - paise(closing)) / 100;
    if (paise(amount) !== 0) gap = { amount, from: maxDate, to: view.openingBalanceAsOf.slice(0, 10), at: addDays(maxDate, 1), direction: 'before' };
  }

  const stale = staleAdjustments(view.transactions, minDate, maxDate);
  const incoming = bridge && gap ? [bridgeAdjustment(gap), ...selected] : [...selected];
  // The whole wallet: what its balance will be.
  const all = mergeImport(wallet, incoming, { opening, statementStart: minDate, removeIds: [...stale, ...replaces], account, rowIds });
  const wholeAfter = afterMerge(wallet, all);
  const projectedFinal = ledgerBalance(wholeAfter);
  // The account on its own: what the check compares with the bank.
  let mineAfter: WalletLedger;
  if (account) {
    const key = accountKey(account.bank, account.last4);
    const anchor = all.account?.anchor ?? wallet.accounts?.[key];
    const own = accountView({ ...wholeAfter, openingBalance: wallet.openingBalance, openingBalanceAsOf: wallet.openingBalanceAsOf }, account, statement);
    mineAfter = { transactions: own.transactions, openingBalance: anchor ? anchor.opening : own.openingBalance, openingBalanceAsOf: null };
  } else {
    mineAfter = afterMerge(view, mergeImport(view, incoming, { opening, statementStart: minDate, removeIds: [...stale, ...replaces] }));
  }
  const later = mineAfter.transactions.filter(t => t.date.slice(0, 10) > maxDate);
  const projected = (paise(ledgerBalance(mineAfter)) - netPaise(later)) / 100;
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
    statement: args.rows
      ? statementCheck({
          rows: args.rows,
          selectedIds: new Set(selected.map(t => t.id)),
          duplicateIds: args.duplicates ?? new Set(),
          walletIds: new Set(wallet.transactions.map(t => t.id)),
          opening,
          closing,
        })
      : null,
    accountOpening: all.account ? { ...all.account, isNew: !wallet.accounts?.[all.account.key] } : null,
  };
}

/**
 * How the review's balance check reads:
 *   - 'ok': the wallet will match the bank on the statement's last day
 *     (bridged or not), with no gap left open;
 *   - 'note': the statement checks out row for row, but the wallet's total
 *     covers more than this account (other accounts, cash, entries typed in,
 *     or a period not imported yet), so it can't equal this closing;
 *   - 'off': the import itself is short (rows that don't add up, left out or
 *     counted twice), or there's no statement check and the wallet differs.
 */
export function tallyTone(t: ImportTally, bridge: boolean): 'ok' | 'note' | 'off' {
  const checks = t.statement?.complete === true;
  if (t.gap && !(bridge && t.matched)) return checks ? 'note' : 'off';
  if (t.matched) return 'ok';
  return checks ? 'note' : 'off';
}
