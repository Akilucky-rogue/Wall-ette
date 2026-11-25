/**
 * Pulse's analysis of a month: the figures, the data behind its charts and
 * the smart insights, worked out on the phone from spending and income
 * (money moved between your own accounts, to family or to investments is
 * left out: pass the wallet's `counted`).
 *
 *   months   the last six months, money in and out (Money in and out)
 *   usual    each category this month against its average over the months
 *            before that the data fully covers (up to three)
 *   pace     spending added up day by day, this month and the one before,
 *            and where the month is heading
 *   split    bills (fixed costs: rent, utilities, subscriptions, and payees
 *            that charge on a schedule outside everyday categories),
 *            everyday spending and one-off payments
 *   insights short, specific findings, most useful first
 *
 * Accuracy rules, each checked by scripts/check-pulse.mjs:
 *   - Every figure adds up: categories, the split, the days and the month's
 *     column all come to the month's spending; shares come to 100.
 *   - The projection only runs everyday spending forward at its daily rate.
 *     Bills and one-offs already paid are counted once, and bills still due
 *     this month are added from their schedule.
 *   - The live month is compared with the same day of the month before, never
 *     with a whole month; "usual" and averages leave out the first month of
 *     data when it starts part-way through, and months with no data.
 *   - When the newest entry is more than three days old, the live month is
 *     read up to that day, and says so.
 *
 * No React, no Firebase: scripts/check-pulse.mjs runs it in Node.
 */
import { AppScreen, Category, Transaction, TransactionType } from '../types';
import { detectRecurringCharges, normalizeMerchant, prettyMerchant } from './analyticsService';
import { addDays, isDay, localDay, parseDay } from '../utils/dates';
import type { ScreenSection } from '../utils/screenSection';

export interface MonthPoint {
  /** 'YYYY-MM' */
  key: string;
  /** 'Nov' */
  label: string;
  cameIn: number;
  spent: number;
  /** Any entry this month, in or out. */
  hasData: boolean;
  /** The data covers the whole month (not the first month when it starts late, not the live month). */
  complete: boolean;
}

export interface UsualRow {
  category: string;
  now: number;
  /** Average a month over the fully covered months before with spending (up to three). */
  usual: number;
  delta: number;
}

export interface Pace {
  daysInMonth: number;
  /** Spending added up by the end of each day of this month; null after `through`. */
  now: (number | null)[];
  /** The same for the month before, as many days as it had (empty if it has no data). */
  before: number[];
  /** The last day the month's line covers: the month's last day, today, or the newest entry's day. */
  through: number;
  /** Today's day of the month in the live month, else null. */
  today: number | null;
  /** The live month's entries stop more than three days before today. */
  behind: boolean;
  /** Where the month ends (live month, from day 3): see `projection`. */
  projected: number | null;
  /** What the projection is made of. */
  projection: { soFar: number; everydayPerDay: number; everydayToCome: number; billsToCome: number } | null;
}

export interface Split {
  bills: number;
  everyday: number;
  oneOffs: number;
  billPayees: number;
  /** Shares of the month's spending in whole percent, adding up to 100 (or all 0). */
  shares: [number, number, number];
}

export interface PayeeRow { name: string; amount: number; count: number }

export type InsightTone = 'watch' | 'good' | 'info';

export interface Insight {
  id: string;
  icon: string;
  tone: InsightTone;
  title: string;
  detail: string;
  action?: { screen: AppScreen; section?: ScreenSection; label: string };
}

export interface Compare {
  /** 'sameDay': the live month up to `day` against the month before up to the same day. */
  kind: 'sameDay' | 'month';
  day: number | null;
  /** This month's side of the comparison. */
  now: number;
  /** The month before's side. */
  before: number;
  /** % change, rounded. */
  change: number;
}

export interface PulseInput {
  counted: Transaction[];
  /** Any day in the month to look at. */
  month: Date;
  now?: Date;
  /** An amount in INR as the app shows it, whole units. */
  money: (n: number) => string;
  budgets?: Record<string, number>;
}

export interface PulseResult {
  /** 'YYYY-MM' */
  key: string;
  /** 'November 2026' */
  label: string;
  /** 'November' */
  name: string;
  /** 'October' */
  prevName: string;
  isCurrent: boolean;
  spent: number;
  cameIn: number;
  /** cameIn − spent */
  kept: number;
  /** Share of what came in that was kept, rounded (null when nothing came in). */
  keptPct: number | null;
  prevSpent: number;
  prevCameIn: number;
  /** Spending against the month before, like for like (null without a fully covered month before). */
  compare: Compare | null;
  /** The months "usual" averages over, newest first ('YYYY-MM'). */
  baseline: string[];
  /** Spending on each day of this month. */
  daily: number[];
  /** Everyday spending a day on each weekday so far, Sunday first, and how many of each day. */
  weekdays: { avg: number; days: number }[];
  months: MonthPoint[];
  usual: UsualRow[];
  pace: Pace;
  split: Split;
  payees: PayeeRow[];
  /** Spending by category this month, largest first, with whole-percent shares adding up to 100. */
  categories: { name: string; amount: number; count: number; share: number }[];
  insights: Insight[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (t: Transaction): string => (isDay(t.date) ? t.date : localDay(parseDay(t.date)));
const keyOf = (y: number, m: number): string => `${y}-${String(m + 1).padStart(2, '0')}`;
const monthIndex = (key: string): number => +key.slice(0, 4) * 12 + (+key.slice(5) - 1);
const keyFromIndex = (i: number): string => keyOf(Math.floor(i / 12), i % 12);
const dayKey = (key: string, d: number): string => `${key}-${String(d).padStart(2, '0')}`;
const shortMonth = (key: string): string =>
  new Date(+key.slice(0, 4), +key.slice(5) - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
const longMonth = (key: string): string =>
  new Date(+key.slice(0, 4), +key.slice(5) - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
const pct = (part: number, whole: number): number => Math.round((part / whole) * 100);
const daysBetween = (a: string, b: string): number => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY_MS);

/**
 * Whole-percent shares of `values` that add up to exactly 100 (largest
 * remainder), or all 0 when they sum to nothing.
 */
export function wholeShares(values: number[]): number[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (!(total > 0)) return values.map(() => 0);
  const raw = values.map(v => (Math.max(0, v) / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || values[b.i] - values[a.i]);
  for (const { i } of order) { if (left <= 0) break; floors[i]++; left--; }
  return floors;
}

/** A one-off: at least this many times the month's median payment … */
const ONE_OFF_MEDIANS = 3;
/** … and at least this much. */
const ONE_OFF_MIN = 2000;
/** Fixed costs: these categories are bills whether or not they repeat yet. */
const BILL_LIST: readonly Category[] = [
  'Rent', 'Utilities', 'Electricity', 'Water', 'Gas', 'Phone & Internet', 'Insurance', 'Loan & EMI',
  'Credit Card', 'Bills', 'Subscriptions', 'Streaming', 'Music', 'Gym', 'Courses', 'Education',
];
/** Day-to-day spending: never a bill, even at the same place every month. */
const EVERYDAY_LIST: readonly Category[] = [
  'Groceries', 'Dining', 'Food Delivery', 'Coffee', 'Transport', 'Fuel', 'Parking', 'Taxi & Cab', 'Metro', 'Train',
  'Shopping', 'Online Shopping', 'Clothing', 'Entertainment', 'Movies', 'Games', 'Personal Care', 'Beauty', 'Pharmacy',
  'Pets', 'Cash Withdrawal',
];
const BILL_CATEGORIES: ReadonlySet<string> = new Set(BILL_LIST);
const EVERYDAY_CATEGORIES: ReadonlySet<string> = new Set(EVERYDAY_LIST);
/** A payee that charges on a schedule is a bill unless its category is everyday spending. */
const isBill = (category: string, repeats: boolean): boolean =>
  BILL_CATEGORIES.has(category) || (repeats && !EVERYDAY_CATEGORIES.has(category));
/** A category change worth a line: at least this much … */
const USUAL_MIN_DELTA = 500;
/** … and this share of its usual. */
const USUAL_MIN_SHARE = 0.25;
/** The first month of data counts as complete when it starts by this day. */
const FULL_FROM_DAY = 7;
/** Entries this many days older than today mean the live month is read up to them (as Left to spend). */
const BEHIND_DAYS = 3;
/** A bill a few days late is still expected; much later, it has probably stopped (as Left to spend). */
const LATE_BILL_DAYS = 7;
const STEP_DAYS: Record<string, number> = { WEEKLY: 7, BIWEEKLY: 14 };

export function analyzePulse({ counted, month, now = new Date(), money, budgets = {} }: PulseInput): PulseResult {
  const key = keyOf(month.getFullYear(), month.getMonth());
  const idx = monthIndex(key);
  const prevKey = keyFromIndex(idx - 1);
  const todayStr = localDay(now);
  const todayKey = todayStr.slice(0, 7);
  const isCurrent = key === todayKey;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const prevDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
  const name = longMonth(key);
  const prevName = longMonth(prevKey);

  // ── One pass: totals per month, categories, days; where the data starts and ends ──
  const inBy = new Map<string, number>();
  const outBy = new Map<string, number>();
  const anyIn = new Set<string>();
  const catBy = new Map<string, Map<string, number>>(); // month → category → spent
  const nowDaily: number[] = new Array(daysInMonth).fill(0);
  const prevDaily: number[] = new Array(prevDays).fill(0);
  const thisMonth: Transaction[] = [];
  let first = '', newest = '';
  for (const t of counted) {
    const day = dayOf(t);
    const mk = day.slice(0, 7);
    if (!first || day < first) first = day;
    if (day > newest) newest = day;
    anyIn.add(mk);
    if (t.type === TransactionType.INCOME) {
      inBy.set(mk, (inBy.get(mk) ?? 0) + t.amount);
      continue;
    }
    outBy.set(mk, (outBy.get(mk) ?? 0) + t.amount);
    let cats = catBy.get(mk);
    if (!cats) { cats = new Map(); catBy.set(mk, cats); }
    cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
    if (mk === key) { nowDaily[+day.slice(8) - 1] += t.amount; thisMonth.push(t); }
    else if (mk === prevKey) prevDaily[+day.slice(8) - 1] += t.amount;
  }
  const firstKey = first.slice(0, 7);
  const newestKey = newest.slice(0, 7);
  const daysIn = (k: string): number => new Date(+k.slice(0, 4), +k.slice(5), 0).getDate();
  /**
   * The data covers the whole month: it has entries, it isn't the live month,
   * and the data neither starts late in it nor stops early in it.
   */
  const complete = (k: string): boolean =>
    anyIn.has(k) && monthIndex(k) < monthIndex(todayKey) &&
    (monthIndex(k) > monthIndex(firstKey) || +first.slice(8) <= FULL_FROM_DAY) &&
    (monthIndex(k) < monthIndex(newestKey) || +newest.slice(8) > daysIn(k) - FULL_FROM_DAY);

  const spent = outBy.get(key) ?? 0;
  const cameIn = inBy.get(key) ?? 0;
  const prevSpent = outBy.get(prevKey) ?? 0;
  const prevCameIn = inBy.get(prevKey) ?? 0;
  const kept = cameIn - spent;

  // ── Six months of money in and out ──
  const months: MonthPoint[] = [];
  for (let i = idx - 5; i <= idx; i++) {
    const k = keyFromIndex(i);
    months.push({ key: k, label: shortMonth(k), cameIn: inBy.get(k) ?? 0, spent: outBy.get(k) ?? 0, hasData: anyIn.has(k), complete: complete(k) });
  }

  // ── How far the month's data runs ──
  const today = isCurrent ? now.getDate() : null;
  const behind = isCurrent && !!newest && daysBetween(newest, todayStr) > BEHIND_DAYS;
  const through = !isCurrent ? daysInMonth
    : !behind ? today!
    : newest.slice(0, 7) === key ? +newest.slice(8) : 0;

  // ── Bills, everyday and one-offs ──
  // Recurring payees as they stood at the time: the month's end for a past
  // month, today for the live one.
  const asOf = isCurrent ? now : new Date(month.getFullYear(), month.getMonth(), daysInMonth, 23, 59);
  const asOfDay = localDay(asOf);
  const charges = detectRecurringCharges(isCurrent ? counted : counted.filter(t => dayOf(t) <= asOfDay), asOf, Infinity);
  const billKeys = new Set(charges.map(r => normalizeMerchant(r.name)).filter(Boolean));
  const amounts = thisMonth.map(t => t.amount).sort((a, b) => a - b);
  const median = amounts.length ? amounts[Math.floor(amounts.length / 2)] : 0;
  const oneOffFloor = Math.max(median * ONE_OFF_MEDIANS, ONE_OFF_MIN);
  let bills = 0, oneOffs = 0, everyday = 0;
  const everydayDaily: number[] = new Array(daysInMonth).fill(0);
  const billPayees = new Set<string>();
  let biggestOneOff: Transaction | null = null;
  for (const t of thisMonth) {
    const k = normalizeMerchant(t.merchant || '');
    if (isBill(t.category, !!k && billKeys.has(k))) {
      bills += t.amount;
      billPayees.add(k || t.category);
    } else if (t.amount >= oneOffFloor) {
      oneOffs += t.amount;
      if (!biggestOneOff || t.amount > biggestOneOff.amount) biggestOneOff = t;
    } else {
      everyday += t.amount;
      everydayDaily[+dayOf(t).slice(8) - 1] += t.amount;
    }
  }
  const shares = wholeShares([bills, everyday, oneOffs]) as [number, number, number];

  // ── Pace: added up day by day, and where the month is heading ──
  let run = 0;
  const nowCum = nowDaily.map((v, i) => {
    run += v;
    return i + 1 > through ? null : run;
  });
  run = 0;
  const prevCum = anyIn.has(prevKey) ? prevDaily.map(v => (run += v)) : [];
  const soFar = through > 0 ? (nowCum[through - 1] ?? 0) : 0;
  let projection: Pace['projection'] = null;
  // A month with no spending in it yet has nothing to run forward: no "₹0" course.
  if (isCurrent && through >= 3 && thisMonth.length > 0) {
    // Everyday spending runs on at its rate so far; bills and one-offs
    // already paid are counted once; bills still due are added.
    const everydaySoFar = everydayDaily.slice(0, through).reduce((s, v) => s + v, 0);
    const everydayPerDay = everydaySoFar / through;
    const everydayToCome = everydayPerDay * (daysInMonth - through);
    const throughDay = dayKey(key, through);
    const monthEnd = dayKey(key, daysInMonth);
    let billsToCome = 0;
    for (const r of charges) {
      if (!isBill(r.category, true)) continue;
      let due = localDay(r.nextExpected);
      if (due < addDays(throughDay, -LATE_BILL_DAYS)) continue;
      if (due <= throughDay) due = addDays(throughDay, 1);
      const step = STEP_DAYS[r.cadence];
      while (due <= monthEnd) {
        billsToCome += r.amount;
        if (!step) break;
        due = addDays(due, step);
      }
    }
    projection = { soFar, everydayPerDay, everydayToCome, billsToCome };
  }
  const projected = projection ? Math.round(projection.soFar + projection.everydayToCome + projection.billsToCome) : null;

  // ── Like for like against the month before ──
  let compare: Compare | null = null;
  if (complete(prevKey) && prevSpent > 0) {
    if (isCurrent) {
      if (through >= 1) {
        const day = Math.min(through, prevDays);
        const before = prevCum[day - 1] ?? 0;
        if (before > 0) compare = { kind: 'sameDay', day: through, now: soFar, before, change: Math.round(((soFar - before) / before) * 100) };
      }
    } else if (spent > 0) {
      compare = { kind: 'month', day: null, now: spent, before: prevSpent, change: Math.round(((spent - prevSpent) / prevSpent) * 100) };
    }
  }

  // ── Each category against its usual: the fully covered months before with
  // spending (up to three), whole months for a past month; for the live month
  // the same days of those months, so a part month meets a part month ──
  const baseline = [1, 2, 3].map(n => keyFromIndex(idx - n)).filter(k => complete(k) && (outBy.get(k) ?? 0) > 0);
  const nowCats = catBy.get(key) ?? new Map<string, number>();
  const usual: UsualRow[] = [];
  if (baseline.length > 0 && through > 0) {
    const mine = new Map<string, number>();
    const theirs = new Map<string, number>();
    for (const t of thisMonth) {
      if (+dayOf(t).slice(8) <= through) mine.set(t.category, (mine.get(t.category) ?? 0) + t.amount);
    }
    const inBaseline = new Set(baseline);
    for (const t of counted) {
      if (t.type === TransactionType.INCOME) continue;
      const day = dayOf(t);
      if (!inBaseline.has(day.slice(0, 7)) || +day.slice(8) > through) continue;
      theirs.set(t.category, (theirs.get(t.category) ?? 0) + t.amount);
    }
    for (const n of new Set([...mine.keys(), ...theirs.keys()])) {
      const avg = (theirs.get(n) ?? 0) / baseline.length;
      const v = mine.get(n) ?? 0;
      usual.push({ category: n, now: v, usual: avg, delta: v - avg });
    }
    usual.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.category.localeCompare(b.category));
  }

  // ── Payees and categories this month ──
  const payeeBy = new Map<string, PayeeRow>();
  for (const t of thisMonth) {
    const n = prettyMerchant(t.merchant || t.category);
    const row = payeeBy.get(n) ?? { name: n, amount: 0, count: 0 };
    row.amount += t.amount; row.count++;
    payeeBy.set(n, row);
  }
  const payees = [...payeeBy.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)).slice(0, 5);
  const catCount = new Map<string, number>();
  for (const t of thisMonth) catCount.set(t.category, (catCount.get(t.category) ?? 0) + 1);
  const catRows = [...nowCats.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const catShares = wholeShares(catRows.map(([, v]) => v));
  const categories = catRows.map(([n, amount], i) => ({ name: n, amount, count: catCount.get(n) ?? 0, share: catShares[i] }));

  // ── Weekdays: everyday spending a day, over the days covered ──
  const wk = Array.from({ length: 7 }, () => ({ sum: 0, days: 0 }));
  for (let d = 1; d <= through; d++) {
    const dow = new Date(month.getFullYear(), month.getMonth(), d).getDay();
    wk[dow].sum += everydayDaily[d - 1];
    wk[dow].days++;
  }
  const weekdays = wk.map(w => ({ avg: w.days ? w.sum / w.days : 0, days: w.days }));

  // ── Insights ──
  const watch: (Insight & { weight: number })[] = [];
  const good: (Insight & { weight: number })[] = [];
  const info: (Insight & { weight: number })[] = [];
  const asOfText = behind && through > 0 ? ` (entries up to ${through} ${shortMonth(key)})` : '';

  // Where the month is heading, or how it compares
  if (isCurrent && projected !== null && through >= 5 && complete(prevKey) && prevSpent > 0) {
    const diff = projected - prevSpent;
    const tone: InsightTone = diff > prevSpent * 0.1 ? 'watch' : diff < -prevSpent * 0.1 ? 'good' : 'info';
    const p = projection!;
    (tone === 'watch' ? watch : tone === 'good' ? good : info).push({
      id: 'pace', icon: 'speed', tone, weight: Math.abs(diff),
      title: `On course for ${money(projected)} this month`,
      detail: `${money(Math.abs(diff))} ${diff >= 0 ? 'more' : 'less'} than ${prevName}'s ${money(prevSpent)}. `
        + `That's ${money(p.soFar)} so far${asOfText}, everyday spending of about ${money(p.everydayPerDay)} a day for the rest of the month`
        + `${p.billsToCome > 0 ? `, and ${money(p.billsToCome)} of bills still due` : ''}.`,
      action: { screen: AppScreen.PULSE_TRENDS, label: 'See the pace' },
    });
  } else if (!isCurrent && compare && Math.abs(compare.change) >= 10) {
    const up = compare.change > 0;
    (up ? watch : good).push({
      id: 'change', icon: up ? 'trending_up' : 'trending_down', tone: up ? 'watch' : 'good', weight: Math.abs(spent - prevSpent),
      title: `Spending ${up ? 'up' : 'down'} ${Math.abs(compare.change)}% on ${prevName}`,
      detail: `${money(spent)} in ${name} against ${money(prevSpent)}.`,
      action: { screen: AppScreen.PULSE_TRENDS, label: 'See trends' },
    });
  }

  // Categories well above or below their usual
  const usualText = (v: number): string => baseline.length === 1
    ? `${money(v)} in ${longMonth(baseline[0])}${isCurrent ? ` by day ${through}` : ''}`
    : `${money(v)}${isCurrent ? ` by day ${through}` : ' a month'}, on average over the ${baseline.length} months before`;
  const above = usual.filter(u => u.now > 0 && u.delta >= USUAL_MIN_DELTA && u.delta >= u.usual * USUAL_MIN_SHARE);
  const below = usual.filter(u => u.usual > 0 && -u.delta >= USUAL_MIN_DELTA && -u.delta >= u.usual * USUAL_MIN_SHARE);
  if (above[0]) {
    const u = above[0];
    watch.push({
      id: `above:${u.category}`, icon: 'north_east', tone: 'watch', weight: u.delta,
      title: u.usual > 0 ? `${u.category} is ${money(u.delta)} above usual` : `${money(u.now)} on ${u.category}, new this month`,
      detail: u.usual > 0
        ? `${money(u.now)} this month${isCurrent ? ' so far' : ''} against ${usualText(u.usual)}.`
        : `Nothing went to ${u.category}${isCurrent ? ` by day ${through}` : ''} in ${baseline.length === 1 ? longMonth(baseline[0]) : `the ${baseline.length} months before`}.`,
      action: { screen: AppScreen.PULSE_CATEGORIES, label: 'See categories' },
    });
  }
  if (below[0]) {
    const u = below[0];
    good.push({
      id: `below:${u.category}`, icon: 'south_east', tone: 'good', weight: -u.delta,
      title: `${u.category} is ${money(-u.delta)} below usual`,
      detail: `${money(u.now)} this month${isCurrent ? ' so far' : ''} against ${usualText(u.usual)}.`,
      action: { screen: AppScreen.PULSE_CATEGORIES, label: 'See categories' },
    });
  }

  // Over budget (the biggest)
  const over = Object.entries(budgets)
    .filter(([, b]) => b > 0)
    .map(([cat, b]) => ({ cat, b, used: nowCats.get(cat) ?? 0 }))
    .filter(r => r.used > r.b)
    .sort((a, b) => (b.used - b.b) - (a.used - a.b));
  if (over[0]) {
    const r = over[0];
    watch.push({
      id: `budget:${r.cat}`, icon: 'error', tone: 'watch', weight: r.used - r.b,
      title: `${r.cat} is ${money(r.used - r.b)} over budget`,
      detail: `${money(r.used)} spent against a ${money(r.b)} budget${over.length > 1 ? `; ${over.length - 1} more ${over.length === 2 ? 'category is' : 'categories are'} over too` : ''}.`,
      action: { screen: AppScreen.INCOME_INSIGHTS, section: 'goals', label: 'See budgets' },
    });
  }

  // What was kept
  if (cameIn > 0) {
    const keptPct = pct(kept, cameIn);
    const history = months.slice(0, -1).filter(m => m.complete && m.cameIn > 0);
    const avg = history.length ? Math.round(history.reduce((s, m) => s + ((m.cameIn - m.spent) / m.cameIn) * 100, 0) / history.length) : null;
    if (kept < 0) {
      watch.push({
        id: 'kept', icon: 'savings', tone: 'watch', weight: -kept,
        title: `${money(-kept)} more went out than came in`,
        detail: `${money(spent)} spent against ${money(cameIn)} in${isCurrent ? ' so far this month' : ''}.`,
        action: { screen: AppScreen.INCOME_INSIGHTS, label: 'See Flow' },
      });
    } else {
      // A month in progress isn't judged against whole months: it reads as a
      // fact, not as good or bad.
      const tone: InsightTone = isCurrent ? 'info' : avg !== null ? (keptPct >= avg ? 'good' : 'info') : keptPct >= 20 ? 'good' : 'info';
      (tone === 'good' ? good : info).push({
        id: 'kept', icon: 'savings', tone, weight: kept,
        title: isCurrent ? `You've kept ${keptPct}% of what came in so far` : `You kept ${keptPct}% of what came in`,
        detail: `${money(kept)} of ${money(cameIn)}.`
          + (!isCurrent && avg !== null ? ` Your average over the ${history.length === 1 ? 'month' : `${history.length} months`} before is ${avg}%.` : ''),
        action: { screen: AppScreen.INCOME_INSIGHTS, label: 'See Flow' },
      });
    }
  }

  // Bills' share (the same whole percent the split bar shows)
  if (bills > 0 && spent > 0) {
    info.push({
      id: 'bills', icon: 'event_repeat', tone: 'info', weight: bills,
      title: `Bills take ${shares[0]}% of your spending`,
      detail: `${money(bills)} on ${billPayees.size} fixed ${billPayees.size === 1 ? 'cost' : 'costs'}, such as rent, utilities and subscriptions. The rest is everyday spending${oneOffs > 0 ? ' and one-offs' : ''}.`,
      action: { screen: AppScreen.PULSE_RECURRING, label: 'See recurring' },
    });
  }

  // Weekends against weekdays: everyday spending a day, bills and one-offs left out
  let weSum = 0, weDays = 0, wkSum = 0, wkDays = 0;
  weekdays.forEach((w, dow) => {
    const total = w.avg * w.days;
    if (dow === 0 || dow === 6) { weSum += total; weDays += w.days; } else { wkSum += total; wkDays += w.days; }
  });
  if (weDays >= 4 && wkDays >= 8) {
    const weAvg = weSum / weDays, wkAvg = wkSum / wkDays;
    if (weAvg >= wkAvg * 1.5 && weAvg - wkAvg >= 300) {
      info.push({
        id: 'weekends', icon: 'weekend', tone: 'info', weight: (weAvg - wkAvg) * weDays,
        title: `Weekends cost about ${money(weAvg)} a day`,
        detail: `Against ${money(wkAvg)} on weekdays, counting everyday spending only.`,
        action: { screen: AppScreen.PULSE_TRENDS, label: 'See weekdays' },
      });
    }
  }

  // The biggest one-off
  if (biggestOneOff) {
    const d = parseDay(dayOf(biggestOneOff)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    info.push({
      id: `oneoff:${biggestOneOff.id}`, icon: 'shopping_bag', tone: 'info', weight: biggestOneOff.amount * 0.5,
      title: `Biggest one-off: ${prettyMerchant(biggestOneOff.merchant || biggestOneOff.category)}`,
      detail: `${money(biggestOneOff.amount)} on ${d}${oneOffs > biggestOneOff.amount ? `; ${money(oneOffs)} in one-offs this month` : ''}.`,
    });
  }

  // Days without spending
  if (spent > 0 && through > 0) {
    const quiet = nowDaily.slice(0, through).filter(v => v === 0).length;
    if (quiet >= 5) {
      good.push({
        id: 'quiet', icon: 'self_improvement', tone: 'good', weight: quiet * 100,
        title: `${quiet} days without spending`,
        detail: `${isCurrent ? 'So far this month' : `In ${name}`}, out of ${through}.`,
      });
    }
  }

  const ordered = [
    ...watch.sort((a, b) => b.weight - a.weight),
    ...good.sort((a, b) => b.weight - a.weight),
    ...info.sort((a, b) => b.weight - a.weight),
  ].map(({ weight: _w, ...rest }) => rest);

  return {
    key, label: `${name} ${key.slice(0, 4)}`, name, prevName, isCurrent,
    spent, cameIn, kept, keptPct: cameIn > 0 ? pct(kept, cameIn) : null,
    prevSpent, prevCameIn, compare, baseline,
    daily: nowDaily,
    weekdays,
    months,
    usual: usual.slice(0, 6),
    pace: { daysInMonth, now: nowCum, before: prevCum, through, today, behind, projected, projection },
    split: { bills, everyday, oneOffs, billPayees: billPayees.size, shares },
    payees,
    categories,
    insights: ordered,
  };
}
