/**
 * Wall·ette Wrapped: one year of a wallet, as the story in Rewind and the
 * card it shares (components/WrappedStory.tsx, utils/wrappedCard.ts).
 *
 * Money figures come from `counted` (entries with money moved left out, under
 * the category each reads as), so Wrapped agrees with Pulse and Home. The
 * days it speaks of (no-spend days, the longest quiet stretch) only cover
 * the span the year's entries reach: a wallet started in October doesn't
 * claim nine quiet months.
 */
import { TransactionType, type Transaction } from '../types';
import { prettyMerchant } from './analyticsService';
import { addDays, parseDay } from '../utils/dates';

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// Moving your own money, cash and pay requests aren't spending moments: they'd
// otherwise top the payees and the biggest spend.
const TRANSFER_RX = /^(ift|imps|rtgs)[\s/-]|payrequest|^atm[\s/-]/i;
// Payments nobody has said what they were for (often to a person) stay out of
// "most paid to" and the biggest spend.
const UNSORTED = new Set(['To review', 'Transfer Out', 'Cash Withdrawal']);

export interface WrappedYear {
  year: number;
  /** The year isn't over. */
  current: boolean;
  /** Every entry dated in the year, money moved included. */
  entries: number;
  /** The first and last day the year's entries reach ('YYYY-MM-DD'). */
  from: string;
  to: string;
  inc: number;
  out: number;
  /** inc − out; negative when more went out. */
  kept: number;
  /** Kept as a share of what came in (rounded %), or null with nothing in. */
  rate: number | null;
  /** Up to three, by spending, with each one's share of it (0–1). */
  categories: { name: string; amount: number; share: number }[];
  /** Up to three payees by spending, and how many payments each. */
  payees: { name: string; amount: number; count: number }[];
  /** The payee paid most often, when one was paid at least three times. */
  regular: { name: string; count: number } | null;
  /** Spending in each month, January first. */
  months: number[];
  /** The month with the most spending (0–11), or null with none. */
  busiestMonth: number | null;
  /** The weekday with the most spending (0 = Sunday), or null with none. */
  busiestWeekday: number | null;
  /** Saturday and Sunday's share of spending (0–1), or null with none. */
  weekendShare: number | null;
  /** Days in from–to without a payment out. */
  noSpendDays: number;
  /** The longest run of days without spending between two that had some. */
  quietest: { days: number; from: string; to: string } | null;
  /** The biggest single payment out. */
  biggest: { amount: number; name: string; date: string } | null;
}

const DAY_MS = 86_400_000;
// Whole days between local calendar days (rounded, so a clock change can't skew it).
const dayNumber = (day: string) => Math.round(parseDay(day).getTime() / DAY_MS);

/** Years with entries, newest first. */
export function wrappedYears(transactions: readonly Pick<Transaction, 'date'>[]): number[] {
  const years = new Set<number>();
  for (const t of transactions) {
    const y = Number(t.date.slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

/**
 * One year, or null when it has no entries. `transactions` is every entry
 * (for the count and the span), `counted` the ones that are real money in
 * and out.
 */
export function wrapYear(
  transactions: readonly Transaction[],
  counted: readonly Transaction[],
  year: number,
  today: Date = new Date(),
): WrappedYear | null {
  const prefix = `${year}-`;
  let entries = 0;
  let from = '';
  let to = '';
  for (const t of transactions) {
    if (!t.date.startsWith(prefix)) continue;
    entries++;
    const day = t.date.slice(0, 10);
    if (!from || day < from) from = day;
    if (!to || day > to) to = day;
  }
  if (entries === 0) return null;

  let inc = 0;
  let out = 0;
  const cats = new Map<string, number>();
  const payees = new Map<string, { amount: number; count: number }>();
  const months: number[] = Array(12).fill(0);
  const weekdays: number[] = Array(7).fill(0);
  const spendDays = new Set<string>();
  let biggest: WrappedYear['biggest'] = null;

  for (const t of counted) {
    if (!t.date.startsWith(prefix)) continue;
    if (t.type === TransactionType.INCOME) { inc += t.amount; continue; }
    out += t.amount;
    const day = t.date.slice(0, 10);
    const d = parseDay(day);
    months[d.getMonth()] += t.amount;
    weekdays[d.getDay()] += t.amount;
    spendDays.add(day);
    const category = t.category?.trim() || 'Uncategorized';
    cats.set(category, (cats.get(category) ?? 0) + t.amount);
    const merchant = t.merchant?.trim();
    if (!merchant || TRANSFER_RX.test(merchant) || UNSORTED.has(category)) continue;
    const name = prettyMerchant(merchant);
    if (!name) continue;
    const p = payees.get(name) ?? { amount: 0, count: 0 };
    p.amount += t.amount;
    p.count++;
    payees.set(name, p);
    if (!biggest || t.amount > biggest.amount) biggest = { amount: t.amount, name, date: day };
  }

  const top = <T,>(m: Map<string, T>, by: (v: T) => number) =>
    [...m.entries()].sort((a, b) => by(b[1]) - by(a[1]) || (a[0] < b[0] ? -1 : 1));
  const categories = top(cats, v => v).slice(0, 3).map(([name, amount]) => ({ name, amount, share: out > 0 ? amount / out : 0 }));
  const payeeList = top(payees, v => v.amount).slice(0, 3).map(([name, v]) => ({ name, amount: v.amount, count: v.count }));
  const byCount = top(payees, v => v.count)[0];
  const regular = byCount && byCount[1].count >= 3 ? { name: byCount[0], count: byCount[1].count } : null;

  const argmax = (xs: number[]) => {
    let best = -1;
    for (let i = 0; i < xs.length; i++) if (xs[i] > 0 && (best < 0 || xs[i] > xs[best])) best = i;
    return best < 0 ? null : best;
  };

  // Quiet days: only within the span the entries reach.
  const span = dayNumber(to) - dayNumber(from) + 1;
  const noSpendDays = Math.max(0, span - spendDays.size);
  const sorted = [...spendDays].sort();
  let quietest: WrappedYear['quietest'] = null;
  for (let i = 1; i < sorted.length; i++) {
    const gap = dayNumber(sorted[i]) - dayNumber(sorted[i - 1]) - 1;
    if (gap > 0 && (!quietest || gap > quietest.days)) {
      quietest = { days: gap, from: addDays(sorted[i - 1], 1), to: addDays(sorted[i], -1) };
    }
  }

  const weekend = weekdays[0] + weekdays[6];
  return {
    year,
    current: year >= today.getFullYear(),
    entries,
    from,
    to,
    inc,
    out,
    kept: inc - out,
    rate: inc > 0 ? Math.round(((inc - out) / inc) * 100) : null,
    categories,
    payees: payeeList,
    regular,
    months,
    busiestMonth: argmax(months),
    busiestWeekday: argmax(weekdays),
    weekendShare: out > 0 ? weekend / out : null,
    noSpendDays,
    quietest,
    biggest,
  };
}

/** "12 Mar" or "12 Mar 2025" for a day of another year than `year`. */
export function shortDay(day: string, year?: number): string {
  const d = parseDay(day);
  return d.toLocaleDateString('en-GB', year === undefined || d.getFullYear() !== year
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' });
}

/** Rounded percent of a share (0–1), never "0%" for a share above zero. */
export function percent(share: number): string {
  const p = Math.round(share * 100);
  return `${share > 0 && p === 0 ? '<1' : p}%`;
}
