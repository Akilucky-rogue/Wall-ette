/**
 * Local analytics engine — pure functions over the transaction list.
 * No network, no AI. Powers Pulse insights and the Income Insights (Flow) screen.
 *
 * Design rule: every detector has a "meaningfulness" threshold so the UI can
 * hide sections instead of showing noise (single data points, tiny amounts).
 */

import { Transaction, TransactionType } from '../types';
import { parseDay } from '../utils/dates';
import { payeeName } from './spend';
import { narrationFields } from './narration';
import { tidyName } from '../utils/names';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

// Tokens that are payment-rail plumbing, not a payee name.
const RAIL_TOKENS = new Set([
  'NEFT', 'UPI', 'IMPS', 'RTGS', 'IFT', 'POS', 'VISA', 'ECOM', 'NACH',
  'ATM', 'NFS', 'OPM', 'MOB', 'DR', 'CR', 'CHQ', 'INB', 'TPT', 'BIL', 'PAYMENT',
]);

/**
 * The payee as the screens show it, from a raw bank narration. Display only:
 * keep the raw string for search, export, edit and `title=` tooltips.
 *   "UPI/DR/615230407557/ZOMATO L/UTIB/zomatoo/UPI"             → "Zomato L"
 *   "NEFT/IN226…/CHOICE EQUITY BROKING PVT LTD/ICIC0099999/…"   → "Choice Equity Broking Pvt Ltd"
 *   "UPI-ZOMATO LTD-zomato@axis-UTIB0…-6152…-NOTE" (HDFC)       → "Zomato Ltd"
 *   "UPI/DR/62…/NETFLIX COM/ICIC/netflix@icici/UPI"             → "Netflix.com"
 *   "NACH/DR/MF SIP/BLUECHIP FUND"                              → "Bluechip Fund"
 * The bank writes the payee in the first field after the payment rail
 * (services/spend.ts payeeName); a field of short codes only ("MF SIP")
 * gives way to a fuller name after it, and a UPI handle ("x@bank") is never
 * the name while there's another. Capitals become a name (utils/names.ts).
 */
export function prettyMerchant(raw: string | undefined | null): string {
  if (!raw) return 'Unknown';
  const clip = (s: string) => (s.length > 32 ? s.slice(0, 31) + '…' : s);
  const fields = narrationFields(raw);
  if (fields.length <= 1) return clip(tidyName(raw));

  const isRef = (s: string) =>
    /^\d{4,}$/.test(s) ||                       // numeric reference
    /^[A-Z]{2,6}\d{4,}/i.test(s) ||             // AXNH2536…, IN226…
    (/^[A-Z0-9]{9,}$/i.test(s) && /\d{2,}/.test(s)); // mixed long refs
  const isRail = (s: string) =>
    RAIL_TOKENS.has(s.toUpperCase()) ||
    /^[A-Z]{4}0[A-Z0-9]{5,}$/i.test(s);         // IFSC codes
  const isHandle = (s: string) => s.includes('@');
  const hasLongWord = (s: string) => s.split(' ').some(w => w.replace(/[^A-Za-z]/g, '').length > 3);
  const score = (s: string) => (s.match(/[A-Za-z ]/g) || []).length;

  const candidates = fields.slice(1).filter(s => !isRail(s) && !isRef(s) && !isHandle(s) && score(s) >= 3);
  const named = payeeName(raw);
  let best = named && !isHandle(named) ? named : null;
  if (best && !hasLongWord(best)) best = candidates.find(hasLongWord) ?? best;
  if (!best && candidates.length) best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
  if (!best) {
    const handle = fields.find(isHandle);
    return handle ? clip(tidyName(handle.split('@')[0])) : clip(raw);
  }
  return clip(tidyName(best));
}

/** Normalize a merchant string for grouping (same rules as import dedup). */
export const normalizeMerchant = (merchant: string): string =>
  merchant
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\d+/g, '')
    .trim();

const median = (sorted: number[]): number =>
  sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];

const mean = (xs: number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

/** Coefficient of variation (std/mean); 0 = perfectly stable. */
const cv = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  if (m === 0) return 0;
  const variance = xs.reduce((s, x) => s + (x - m) * (x - m), 0) / xs.length;
  return Math.sqrt(variance) / m;
};

const monthKey = (d: Date): number => d.getFullYear() * 12 + d.getMonth();

const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// 1) Recurring charge / subscription detection (expenses)
// ─────────────────────────────────────────────────────────────────────────────

export interface RecurringCharge {
  /** Pretty name (most recent raw merchant string of the group) */
  name: string;
  category: string;
  cadence: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';
  /** Typical charge amount (median of matched charges) */
  amount: number;
  /** Normalized to a monthly figure for totals */
  monthlyCost: number;
  yearlyCost: number;
  occurrences: number;
  lastDate: Date;
  nextExpected: Date;
}

interface CadenceRule { name: RecurringCharge['cadence']; min: number; max: number; perMonth: number }
const CADENCES: CadenceRule[] = [
  { name: 'WEEKLY', min: 5, max: 9, perMonth: 30 / 7 },
  { name: 'BIWEEKLY', min: 12, max: 17, perMonth: 30 / 14 },
  { name: 'MONTHLY', min: 25, max: 36, perMonth: 1 },
  { name: 'YEARLY', min: 330, max: 400, perMonth: 1 / 12 },
];

/**
 * Detect recurring charges: same merchant, similar amount (±30% of median),
 * consistent gap matching a known cadence, and still "alive"
 * (last charge within 2 cadence periods of `now`). Pass only counted
 * transactions, so monthly transfers to family or a broker aren't listed as
 * charges (audit M8).
 */
export const detectRecurringCharges = (
  transactions: Transaction[],
  now: Date = new Date()
): RecurringCharge[] => {
  const groups = new Map<string, { tx: Transaction; ts: number }[]>();

  for (const t of transactions) {
    if (t.type !== TransactionType.EXPENSE) continue;
    const key = normalizeMerchant(t.merchant || '') || `cat:${t.category.toLowerCase()}`;
    if (key.length < 3) continue; // too generic to group on
    let bucket = groups.get(key);
    if (!bucket) { bucket = []; groups.set(key, bucket); }
    bucket.push({ tx: t, ts: parseDay(t.date).getTime() });
  }

  const results: RecurringCharge[] = [];

  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    bucket.sort((a, b) => a.ts - b.ts);

    // Amount stability: keep charges within ±30% of the group median
    const amountsSorted = bucket.map(b => b.tx.amount).sort((a, b) => a - b);
    const med = median(amountsSorted);
    if (med < 20) continue; // ignore micro-charges
    const matched = bucket.filter(b => Math.abs(b.tx.amount - med) <= med * 0.3);
    if (matched.length < 2) continue;

    // Cadence: median gap between consecutive matched charges
    const gaps: number[] = [];
    for (let i = 1; i < matched.length; i++) {
      gaps.push((matched[i].ts - matched[i - 1].ts) / DAY_MS);
    }
    const gapMed = median([...gaps].sort((a, b) => a - b));
    const rule = CADENCES.find(c => gapMed >= c.min && gapMed <= c.max);
    if (!rule) continue;

    // For weekly/biweekly require an extra occurrence to avoid coincidences
    if ((rule.name === 'WEEKLY' || rule.name === 'BIWEEKLY') && matched.length < 3) continue;

    // Must still be active: last charge within 2 cadence periods
    const last = matched[matched.length - 1];
    const periodDays = gapMed;
    if (now.getTime() - last.ts > periodDays * 2 * DAY_MS) continue;

    const chargeAmount = median(matched.map(m => m.tx.amount).sort((a, b) => a - b));
    results.push({
      name: last.tx.merchant || last.tx.category,
      category: last.tx.category,
      cadence: rule.name,
      amount: chargeAmount,
      monthlyCost: chargeAmount * rule.perMonth,
      yearlyCost: chargeAmount * rule.perMonth * 12,
      occurrences: matched.length,
      lastDate: new Date(last.ts),
      nextExpected: new Date(last.ts + periodDays * DAY_MS),
    });
  }

  return results.sort((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 8);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2) Income streams, stability, salary detection
// ─────────────────────────────────────────────────────────────────────────────

export type StreamBadge = 'FIXED' | 'RECURRING' | 'OCCASIONAL' | 'ONE_OFF';

export interface IncomeStream {
  name: string;
  /** true when you said this is your pay (or the bank calls it salary), false when you said it isn't */
  isPay: boolean | null;
  category: string;
  badge: StreamBadge;
  /** Typical credit amount (median) */
  typicalAmount: number;
  /** Total received in the trailing 12 months */
  total12m: number;
  /** Share of all income in the trailing 12 months, 0-100 */
  sharePct: number;
  occurrences: number;
  monthsActive: number;
  lastDate: Date;
  /** Median day-of-month the credit arrives (only meaningful for FIXED/RECURRING) */
  typicalDay: number;
}

export interface IncomeStability {
  /** 0-100; 100 = identical income every month */
  score: number;
  label: 'Stable' | 'Variable' | 'Irregular';
  /** Trailing months (oldest → newest), for the trend chart */
  monthlyTotals: { label: string; value: number }[];
  avgMonthly: number;
}

export interface SalaryInfo {
  streamName: string;
  /** false: a guess to confirm before calling it your pay (audit M8) */
  confirmed: boolean;
  /** The payee to save a rule for when you answer, if the narration names one */
  payee: string | null;
  typicalAmount: number;
  typicalDay: number;
  lastDate: Date;
  nextExpected: Date;
  daysUntil: number;
}

export interface IncomeAnalysis {
  streams: IncomeStream[];
  stability: IncomeStability | null;
  salary: SalaryInfo | null;
  totalIncome12m: number;
}

/**
 * Income over the trailing 12 months. Pass only counted transactions (money
 * moved left out), and `isPay` to say which credits you confirmed as pay
 * (true), ruled out (false) or haven't said (null).
 */
export const analyzeIncome = (
  transactions: Transaction[],
  now: Date = new Date(),
  isPay: (t: Transaction) => boolean | null = t => (t.category === 'Salary' ? true : null)
): IncomeAnalysis => {
  const nowKey = monthKey(now);
  const windowStartKey = nowKey - 11;

  // ── Monthly totals (trailing 12 calendar months) ──
  const monthly = new Array(12).fill(0);
  const groups = new Map<string, { tx: Transaction; d: Date }[]>();

  for (const t of transactions) {
    if (t.type !== TransactionType.INCOME) continue;
    const d = parseDay(t.date);
    const k = monthKey(d);
    if (k >= windowStartKey && k <= nowKey) {
      monthly[k - windowStartKey] += t.amount;

      const gKey = normalizeMerchant(t.merchant || '') || `cat:${t.category.toLowerCase()}`;
      let bucket = groups.get(gKey);
      if (!bucket) { bucket = []; groups.set(gKey, bucket); }
      bucket.push({ tx: t, d });
    }
  }

  const totalIncome12m = monthly.reduce((a, b) => a + b, 0);

  // ── Stability: from the first month with income, up to the last 6 months ──
  let stability: IncomeStability | null = null;
  const firstIdx = monthly.findIndex(v => v > 0);
  const monthlyTotals = monthly.map((value, i) => {
    const k = windowStartKey + i;
    const d = new Date(Math.floor(k / 12), k % 12, 1);
    return { label: d.toLocaleString('default', { month: 'short' }), value };
  });
  if (firstIdx !== -1 && 12 - firstIdx >= 2) {
    const series = monthly.slice(Math.max(firstIdx, 12 - 6)); // ≤ last 6 months of activity
    const variation = cv(series);
    const score = Math.round(100 * Math.max(0, 1 - variation));
    stability = {
      score,
      label: score >= 80 ? 'Stable' : score >= 50 ? 'Variable' : 'Irregular',
      monthlyTotals,
      avgMonthly: mean(monthly.slice(firstIdx)),
    };
  }

  // ── Streams ──
  const streams: IncomeStream[] = [];
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.d.getTime() - b.d.getTime());
    const amounts = bucket.map(b => b.tx.amount).sort((a, b) => a - b);
    const typicalAmount = median(amounts);
    const months = new Set(bucket.map(b => monthKey(b.d))).size;
    const days = bucket.map(b => b.d.getDate()).sort((a, b) => a - b);
    const typicalDay = median(days);
    const daySpread = days.length >= 2 ? days[days.length - 1] - days[0] : 0;
    const amountVariation = cv(bucket.map(b => b.tx.amount));
    const total = bucket.reduce((s, b) => s + b.tx.amount, 0);
    const last = bucket[bucket.length - 1];
    const answers = bucket.map(b => isPay(b.tx));
    const pay = answers.includes(true) ? true : answers.includes(false) ? false : null;

    let badge: StreamBadge;
    if (months >= 3 && amountVariation <= 0.1 && daySpread <= 7) badge = 'FIXED';
    else if (months >= 3) badge = 'RECURRING';
    else if (months === 2) badge = 'OCCASIONAL';
    else badge = 'ONE_OFF';

    streams.push({
      name: last.tx.merchant || last.tx.category,
      isPay: pay,
      category: last.tx.category,
      badge,
      typicalAmount,
      total12m: total,
      sharePct: totalIncome12m > 0 ? Math.round((total / totalIncome12m) * 100) : 0,
      occurrences: bucket.length,
      monthsActive: months,
      lastDate: last.d,
      typicalDay,
    });
  }
  streams.sort((a, b) => b.total12m - a.total12m);

  // ── Salary: a stream you confirmed, else the dominant FIXED/RECURRING
  //    stream as a guess to confirm (audit M8: it used to pick a broker payout) ──
  let salary: SalaryInfo | null = null;
  const avgMonthlyIncome = stability?.avgMonthly ?? 0;
  const confirmed = streams.find(s => s.isPay === true);
  const candidate = confirmed ?? streams.find(s =>
    s.isPay === null &&
    (s.badge === 'FIXED' || s.badge === 'RECURRING') &&
    avgMonthlyIncome > 0 && s.typicalAmount >= avgMonthlyIncome * 0.4
  );
  if (candidate) {
    // Next expected: candidate.typicalDay of this month if still ahead, else next month
    const clampDay = (y: number, m: number, day: number) =>
      Math.min(day, new Date(y, m + 1, 0).getDate());
    let y = now.getFullYear();
    let m = now.getMonth();
    if (now.getDate() >= candidate.typicalDay) m += 1;
    const next = new Date(y, m, clampDay(y, m, candidate.typicalDay));
    salary = {
      streamName: candidate.name,
      confirmed: candidate === confirmed,
      payee: payeeName(candidate.name) ?? (candidate.name.includes('/') ? null : candidate.name),
      typicalAmount: candidate.typicalAmount,
      typicalDay: candidate.typicalDay,
      lastDate: candidate.lastDate,
      nextExpected: next,
      daysUntil: Math.max(0, Math.ceil((next.getTime() - now.getTime()) / DAY_MS)),
    };
  }

  return { streams: streams.slice(0, 6), stability, salary, totalIncome12m };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3) Month-over-month category movers (expenses)
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryMover {
  category: string;
  current: number;
  previous: number;
  delta: number;       // current - previous (positive = spent more)
  pctChange: number | null; // null when previous = 0 ("new")
}

export interface MoversResult { up: CategoryMover[]; down: CategoryMover[]; hasPrevData: boolean }

/**
 * Compare categories (of the given type) between the selected month and the
 * month before. Only movers with |delta| ≥ minDelta are reported (noise floor).
 */
export const categoryMovers = (
  transactions: Transaction[],
  selected: Date,
  type: TransactionType = TransactionType.EXPENSE,
  minDelta = 100
): MoversResult => {
  const curKey = monthKey(selected);
  const prevKey = curKey - 1;
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();

  for (const t of transactions) {
    if (t.type !== type) continue;
    const k = monthKey(parseDay(t.date));
    if (k === curKey) cur.set(t.category, (cur.get(t.category) || 0) + t.amount);
    else if (k === prevKey) prev.set(t.category, (prev.get(t.category) || 0) + t.amount);
  }

  const cats = new Set([...cur.keys(), ...prev.keys()]);
  const movers: CategoryMover[] = [];
  for (const c of cats) {
    const a = cur.get(c) || 0;
    const b = prev.get(c) || 0;
    const delta = a - b;
    if (Math.abs(delta) < minDelta) continue;
    movers.push({
      category: c,
      current: a,
      previous: b,
      delta,
      pctChange: b > 0 ? Math.round((delta / b) * 100) : null,
    });
  }

  return {
    up: movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    down: movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
    hasPrevData: prev.size > 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4) Daily heatmap + weekday pattern + budget pace (expenses, one pass)
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthDailyStats {
  /** Spend per day-of-month, index 0 = day 1 */
  daily: number[];
  maxDaily: number;
  /** Average spend per weekday (0=Sun..6=Sat) over the month */
  weekdayAvg: number[];
  busiestWeekday: number;
  /** Cumulative spend by day (same length as daily) */
  cumulative: number[];
  daysInMonth: number;
  /** First weekday (0=Sun) of the month, for calendar alignment */
  firstWeekday: number;
  txCount: number;
}

export const monthDailyStats = (
  expensesInMonth: { date: string; amount: number }[],
  selected: Date
): MonthDailyStats => {
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daily = new Array(daysInMonth).fill(0);
  const weekdaySum = new Array(7).fill(0);
  const weekdayCount = new Array(7).fill(0);

  // How many times each weekday occurs in this month (for true averages)
  for (let day = 1; day <= daysInMonth; day++) {
    weekdayCount[new Date(year, month, day).getDay()]++;
  }

  for (const t of expensesInMonth) {
    const d = parseDay(t.date);
    const day = d.getDate();
    if (day >= 1 && day <= daysInMonth) {
      daily[day - 1] += t.amount;
      weekdaySum[d.getDay()] += t.amount;
    }
  }

  const weekdayAvg = weekdaySum.map((s, i) => (weekdayCount[i] > 0 ? s / weekdayCount[i] : 0));
  let busiestWeekday = 0;
  for (let i = 1; i < 7; i++) if (weekdayAvg[i] > weekdayAvg[busiestWeekday]) busiestWeekday = i;

  const cumulative: number[] = [];
  let run = 0;
  for (const v of daily) { run += v; cumulative.push(run); }

  return {
    daily,
    maxDaily: Math.max(...daily, 0),
    weekdayAvg,
    busiestWeekday,
    cumulative,
    daysInMonth,
    firstWeekday: new Date(year, month, 1).getDay(),
    txCount: expensesInMonth.length,
  };
};

/**
 * Spending pace for the CURRENT month: projection = spent so far scaled to a
 * full month. Reference = dailyLimit×days when a limit is set, else last
 * month's total spend.
 */
export interface PaceResult {
  spentSoFar: number;
  projected: number;
  reference: number;
  referenceKind: 'LIMIT' | 'LAST_MONTH';
  onTrack: boolean;
  elapsedDays: number;
  daysInMonth: number;
}

export const spendingPace = (
  cumulative: number[],
  daysInMonth: number,
  now: Date,
  dailyLimit: number,
  lastMonthTotal: number
): PaceResult | null => {
  const elapsedDays = Math.min(now.getDate(), daysInMonth);
  if (elapsedDays < 3) return null; // too early in the month to be meaningful
  const spentSoFar = cumulative[elapsedDays - 1] ?? 0;
  const projected = (spentSoFar / elapsedDays) * daysInMonth;
  const reference = dailyLimit > 0 ? dailyLimit * daysInMonth : lastMonthTotal;
  if (reference <= 0) return null;
  return {
    spentSoFar,
    projected,
    reference,
    referenceKind: dailyLimit > 0 ? 'LIMIT' : 'LAST_MONTH',
    onTrack: projected <= reference,
    elapsedDays,
    daysInMonth,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Price rises: monthly subscriptions and bills that now cost more than they
// used to (Pulse → Recurring, and the bell on Home).
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceRise {
  /** normalizeMerchant of the payee, for ids. */
  key: string;
  name: string;
  from: number;
  to: number;
  pct: number;
  annualExtra: number;
  /** The latest charge, 'YYYY-MM-DD'. */
  lastDay: string;
}

// Transfers to people repeat by design; they're not subscriptions.
const TRANSFER_RX = /^(ift|imps|neft|rtgs)[\s\/\-]|payrequest|^atm[\s\/\-]|mandate/i;

/**
 * Payees charged a fixed amount about monthly for four months or more whose
 * price went up by 5% and ₹10 or more: the median of the latest third of the
 * charges against the earliest third. Biggest yearly difference first.
 */
export const priceRises = (transactions: Transaction[]): PriceRise[] => {
  const groups = new Map<string, { name: string; events: { date: string; amount: number }[] }>();
  for (const t of transactions) {
    if (t.type !== TransactionType.EXPENSE) continue;
    const key = normalizeMerchant(t.merchant || '');
    if (key.length < 4) continue;
    let g = groups.get(key);
    if (!g) { g = { name: t.merchant || '', events: [] }; groups.set(key, g); }
    g.events.push({ date: t.date.slice(0, 10), amount: t.amount });
  }
  const rises: PriceRise[] = [];
  for (const [key, g] of groups) {
    if (g.events.length < 4) continue;
    if (TRANSFER_RX.test(g.name)) continue;
    g.events.sort((a, b) => (a.date < b.date ? -1 : 1));
    const spanDays = (Date.parse(g.events[g.events.length - 1].date) - Date.parse(g.events[0].date)) / 86400000;
    if (spanDays < 120) continue;
    const gaps: number[] = [];
    for (let i = 1; i < g.events.length; i++) {
      gaps.push((Date.parse(g.events[i].date) - Date.parse(g.events[i - 1].date)) / 86400000);
    }
    gaps.sort((a, b) => a - b);
    const medGap = gaps[Math.floor(gaps.length / 2)];
    if (medGap < 20 || medGap > 45) continue; // monthly-ish only

    const slice = Math.max(2, Math.floor(g.events.length / 3));
    const median = (arr: { amount: number }[]) => {
      const v = arr.map(e => e.amount).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)];
    };
    const cv = (arr: { amount: number }[]) => {
      const vals = arr.map(e => e.amount);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      if (mean <= 0) return 9;
      const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      return sd / mean;
    };
    const firstSlice = g.events.slice(0, slice);
    const lastSlice = g.events.slice(-slice);
    // A real subscription bills a fixed price in each era; payees with
    // varying amounts (ticket sites, aggregators, people) are spending.
    if (cv(firstSlice) > 0.15 || cv(lastSlice) > 0.15) continue;
    const from = median(firstSlice);
    const to = median(lastSlice);
    if (to > from * 1.05 && to - from >= 10) {
      rises.push({
        key, name: g.name, from, to,
        pct: Math.round(((to - from) / from) * 100),
        annualExtra: (to - from) * 12,
        lastDay: g.events[g.events.length - 1].date,
      });
    }
  }
  return rises.sort((a, b) => b.annualExtra - a.annualExtra);
};
