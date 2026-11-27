/**
 * Bank accounts in one wallet. A wallet can hold several (an HDFC salary
 * account and an Equitas savings account, say); each keeps its own opening
 * balance: what it held before its earliest statement in the wallet. The
 * wallet's balance is every account's opening plus every entry.
 *
 * An account is told apart by its bank and the last four digits of its
 * number, which is all Wall-ette keeps of the number.
 *
 * No runtime imports, so the check scripts can run it in Node.
 */
import type { Transaction } from '../types';

export interface AccountAnchor {
  /** The bank, as the statement reader names it ("HDFC Bank"). */
  bank: string;
  /** The account number's last four digits. */
  last4: string;
  /** What the account held before its earliest statement in the wallet. */
  opening: number;
  /** That statement's first day (YYYY-MM-DD), or null if unknown. */
  asOf: string | null;
  /**
   * The account took over the wallet's opening balance from before 1.5.9,
   * when accounts weren't told apart, so the entries imported then (which
   * carry no account) are its own.
   */
  legacy?: boolean;
}

export type AccountAnchors = Readonly<Record<string, AccountAnchor>>;

/** The account's key in a wallet: bank and last four digits. */
export const accountKey = (bank: string, last4: string): string =>
  `${bank.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}:${last4}`;

/** "HDFC Bank ••1234". */
export const accountLabel = (a: Pick<AccountAnchor, 'bank' | 'last4'>): string => `${a.bank} ••${a.last4}`;

/**
 * The last four digits of the account number printed on a statement:
 * "Account No : 501000…1234", "A/C No. XXXX…5678", "Account Number: …". Masked
 * digits (X, *) are fine as long as the last four are digits. Null when the
 * statement doesn't show one.
 */
export function accountLast4(text: string): string | null {
  const m = /\b(?:A\/C|Acc(?:oun)?t)\.?\s*(?:No\.?|Number|#)?\s*[:.\-]?\s*:?\s*([0-9Xx*]{6,24})(?![0-9Xx*])/i.exec(text);
  const tail = m?.[1].slice(-4) ?? '';
  return /^\d{4}$/.test(tail) ? tail : null;
}

/**
 * The account number from the top of a statement's text, where its header
 * is. Further down, narrations can name other accounts ("TRANSFER TO A/C
 * …"), and reading one of those would make one account look like two.
 */
const HEADER_CHARS = 4000;
export const headerLast4 = (text: string): string | null => accountLast4(text.slice(0, HEADER_CHARS));

/** The wallet's opening balance: the one from before accounts, plus each account's. */
export const totalOpening = (unassigned: number, accounts: AccountAnchors | undefined): number =>
  (Math.round(unassigned * 100) + Object.values(accounts ?? {}).reduce((s, a) => s + Math.round(a.opening * 100), 0)) / 100;

/** Accounts read back from saved settings or a backup; anything malformed is left out. */
export function asAccountAnchors(raw: unknown): Record<string, AccountAnchor> {
  const out: Record<string, AccountAnchor> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const a = v as Record<string, unknown>;
    if (typeof a.bank !== 'string' || !a.bank.trim() || a.bank.length > 60) continue;
    if (typeof a.last4 !== 'string' || !/^\d{4}$/.test(a.last4)) continue;
    if (typeof a.opening !== 'number' || !Number.isFinite(a.opening)) continue;
    const asOf = typeof a.asOf === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a.asOf) ? a.asOf.slice(0, 10) : null;
    if (key !== accountKey(a.bank, a.last4)) continue;
    out[key] = { bank: a.bank.trim(), last4: a.last4, opening: Math.round(a.opening * 100) / 100, asOf, ...(a.legacy === true ? { legacy: true } : {}) };
  }
  return out;
}

/** Entries no account claims: typed in, or from statements that don't show their number. */
export const OTHER_ENTRIES = 'other';

/** The account that took over the wallet's opening balance from before 1.5.9, if one did. */
export const legacyAccount = (anchors: AccountAnchors): { key: string; asOf: string | null } | null => {
  for (const [key, a] of Object.entries(anchors)) if (a.legacy) return { key, asOf: a.asOf };
  return null;
};

type Entry = Pick<Transaction, 'amount' | 'type' | 'account' | 'createdAt' | 'date'>;

/**
 * The account an entry counts in on Bank accounts and in Vault's filter: its
 * own (imported from 1.5.9); for a row imported before 1.5.9 (no account,
 * not typed in), the account that took over the opening balance from then,
 * from that balance's day on; otherwise OTHER_ENTRIES.
 */
export function entryAccount(t: Pick<Entry, 'account' | 'createdAt' | 'date'>, legacy: { key: string; asOf: string | null } | null): string {
  if (t.account) return t.account;
  if (!t.createdAt && legacy && (!legacy.asOf || t.date.slice(0, 10) >= legacy.asOf)) return legacy.key;
  return OTHER_ENTRIES;
}

/** "hdfc-bank:1234" as "Hdfc Bank ••1234", for an account the settings don't name. */
const labelOfKey = (key: string): string => {
  const [bank = '', last4 = ''] = key.split(':');
  const name = bank.split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || 'Bank account';
  return /^\d{4}$/.test(last4) ? `${name} ••${last4}` : name;
};

export interface AccountSummary {
  /** accountKey, or OTHER_ENTRIES. */
  key: string;
  label: string;
  /** Its opening balance plus every entry it holds, to the paisa. */
  balance: number;
  entries: number;
  /** Its newest entry's day. */
  latest: string | null;
}

/**
 * Each account's balance and entries, busiest first, and what no account
 * claims (with the opening balance from before 1.5.9 that no account took
 * over). Together they make the wallet's balance, to the paisa.
 */
export function accountSummaries(
  transactions: readonly Entry[],
  anchors: AccountAnchors,
  unassignedOpening: number,
): { accounts: AccountSummary[]; other: AccountSummary | null; total: number } {
  const legacy = legacyAccount(anchors);
  const sums = new Map<string, { paise: number; entries: number; latest: string | null }>();
  const at = (key: string) => {
    let s = sums.get(key);
    if (!s) { s = { paise: 0, entries: 0, latest: null }; sums.set(key, s); }
    return s;
  };
  for (const [key, a] of Object.entries(anchors)) at(key).paise += Math.round(a.opening * 100);
  at(OTHER_ENTRIES).paise += Math.round(unassignedOpening * 100);
  for (const t of transactions) {
    const s = at(entryAccount(t, legacy));
    s.paise += (String(t.type) === 'INCOME' ? 1 : -1) * Math.round(t.amount * 100);
    s.entries++;
    const day = typeof t.date === 'string' ? t.date.slice(0, 10) : '';
    if (day && (!s.latest || day > s.latest)) s.latest = day;
  }
  let total = 0;
  const accounts: AccountSummary[] = [];
  let other: AccountSummary | null = null;
  for (const [key, s] of sums) {
    total += s.paise;
    const summary = {
      key,
      label: key === OTHER_ENTRIES ? 'Other entries' : anchors[key] ? accountLabel(anchors[key]) : labelOfKey(key),
      balance: s.paise / 100,
      entries: s.entries,
      latest: s.latest,
    };
    if (key === OTHER_ENTRIES) { if (s.entries > 0 || s.paise !== 0) other = summary; }
    else accounts.push(summary);
  }
  accounts.sort((a, b) => b.entries - a.entries || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
  return { accounts, other, total: total / 100 };
}
