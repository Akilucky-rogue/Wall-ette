/**
 * Bank accounts in one wallet. A wallet can hold several (an HDFC salary
 * account and an Equitas savings account, say); each keeps its own opening
 * balance: what it held before its earliest statement in the wallet. The
 * wallet's balance is every account's opening plus every entry.
 *
 * An account is told apart by its bank and the last four digits of its
 * number, which is all Wall-ette keeps of the number.
 *
 * No imports, so the check scripts can run it in Node.
 */

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
