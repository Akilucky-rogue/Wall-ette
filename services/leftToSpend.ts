/**
 * Left to spend: what you can still spend before your next pay, once the
 * bills still to come and your savings goal are set aside (Home and its own
 * page, components/LeftToSpend.tsx).
 *
 * The period runs from your last pay to the next one when Wall-ette knows
 * your pay (a confirmed salary stream, services/analyticsService.ts), or
 * through the calendar month otherwise. Within it:
 *
 *   came in      every credit except money from your own accounts
 *   spent        your spending
 *   moved        money sent to family or invested (it has left the account)
 *   bills        recurring charges expected after today and before the period ends
 *   to set aside the savings goal, less what you already invested this period
 *   left         came in − spent − moved − bills − to set aside
 *
 * Money between your own accounts, and entries you marked not to count, are
 * left out both ways. No React, no Firebase: scripts/check-left-to-spend.mjs
 * runs it in Node.
 */
import { Transaction, TransactionType } from '../types';
import { analyzeIncome, detectRecurringCharges } from './analyticsService';
import type { FlowInfo } from './spend';
import { addDays, isDay, localDay, parseDay } from '../utils/dates';

export interface UpcomingBill {
  name: string;
  amount: number;
  /** 'YYYY-MM-DD'; today for a bill that's a few days late. */
  due: string;
  /** The day a late bill was expected, 'YYYY-MM-DD'; null when it isn't late. */
  wasDue: string | null;
}

export interface LeftToSpend {
  /** 'pay': last pay to next pay; 'month': the calendar month. */
  basis: 'pay' | 'month';
  /** First day of the period, 'YYYY-MM-DD'. */
  from: string;
  /** The day the period ends (next pay, or the 1st of next month), 'YYYY-MM-DD'. */
  until: string;
  /** Days from today up to `until`, today included; at least 1. */
  daysLeft: number;
  /** The pay that started the period, when the basis is pay. */
  pay: number | null;
  cameIn: number;
  spent: number;
  /** Sent to family and invested. */
  moved: number;
  /** The invested part of `moved`. */
  invested: number;
  bills: UpcomingBill[];
  billsTotal: number;
  toSetAside: number;
  left: number;
  perDay: number;
  /** How much of what came in is spent, moved or set aside for bills (0..1+). */
  used: number;
  /** The newest entry, 'YYYY-MM-DD'. */
  newest: string;
  /** The newest entry is more than a few days old, so the figure may be behind. */
  behind: boolean;
  /** The next pay was expected by now and hasn't shown up. */
  payLate: boolean;
}

export interface LeftToSpendInput {
  transactions: Transaction[];
  flowOf: (t: Transaction) => FlowInfo;
  savingsGoal: number;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A pay older than this doesn't start the current period. */
const PAY_FRESH_DAYS = 45;
/** Entries older than this make the figure "up to" that day. */
const BEHIND_DAYS = 3;
/** A bill this many days late still counts as to come. */
const LATE_BILL_DAYS = 7;
/** A pay this many days before its usual day is still that month's. */
const EARLY_PAY_DAYS = 5;

const dayOf = (t: Transaction): string => (isDay(t.date) ? t.date : localDay(parseDay(t.date)));
const daysBetween = (from: string, to: string): number =>
  Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

const STEP_DAYS: Record<string, number> = { WEEKLY: 7, BIWEEKLY: 14 };

/** Null when nothing came in during the period yet: there's nothing to divide. */
export function leftToSpend({ transactions, flowOf, savingsGoal, now = new Date() }: LeftToSpendInput): LeftToSpend | null {
  if (transactions.length === 0) return null;
  const today = localDay(now);

  // What counts: everything except your own accounts and entries set to not count.
  const kept: { t: Transaction; info: FlowInfo }[] = [];
  for (const t of transactions) {
    const info = flowOf(t);
    if (info.moved === 'mine' || info.moved === 'ignore' || info.moved === 'adjustment') continue;
    kept.push({ t, info });
  }

  // The period: your pay, when Wall-ette knows it and it's recent.
  const counted = kept.filter(k => k.info.flow !== 'moved').map(k => k.t);
  const salary = analyzeIncome(counted, now, t => {
    const rule = flowOf(t).rule;
    if (rule?.kind === 'salary' || t.category === 'Salary') return true;
    return rule ? false : null;
  }).salary;
  let basis: 'pay' | 'month' = 'month';
  let from = `${today.slice(0, 7)}-01`;
  let until = localDay(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  let pay: number | null = null;
  let payLate = false;
  if (salary?.confirmed) {
    const last = localDay(salary.lastDate);
    if (daysBetween(last, today) <= PAY_FRESH_DAYS) {
      basis = 'pay';
      from = last;
      pay = salary.typicalAmount;
      // This month's pay day, and whether it has come (a pay up to a few days
      // early, before a weekend or holiday, counts as this month's).
      const y = now.getFullYear(), m = now.getMonth();
      const dueThisMonth = localDay(new Date(y, m, Math.min(salary.typicalDay, new Date(y, m + 1, 0).getDate())));
      if (today >= dueThisMonth && daysBetween(last, dueThisMonth) > EARLY_PAY_DAYS) {
        payLate = true;
        until = addDays(today, 1);
      } else {
        until = localDay(salary.nextExpected);
      }
    }
  }

  let cameIn = 0, spent = 0, moved = 0, invested = 0;
  let newest = '';
  for (const { t, info } of kept) {
    const day = dayOf(t);
    if (day > newest) newest = day;
    if (day < from || day > today) continue;
    if (t.type === TransactionType.INCOME) { cameIn += t.amount; continue; }
    if (info.flow === 'moved') {
      moved += t.amount;
      if (info.moved === 'investment') invested += t.amount;
    } else {
      spent += t.amount;
    }
  }
  if (cameIn <= 0) return null;

  // Bills expected from today up to the end of the period: spending, family
  // and investments that repeat.
  const outgoing = kept.filter(k => k.t.type === TransactionType.EXPENSE).map(k => k.t);
  const bills: UpcomingBill[] = [];
  for (const r of detectRecurringCharges(outgoing, now)) {
    const step = STEP_DAYS[r.cadence];
    let due = localDay(r.nextExpected);
    // A few days late is still expected; much later, it has probably stopped.
    if (due < addDays(today, -LATE_BILL_DAYS)) continue;
    let wasDue: string | null = null;
    if (due < today) { wasDue = due; due = today; }
    while (due < until) {
      bills.push({ name: r.name, amount: r.amount, due, wasDue });
      wasDue = null;
      if (!step) break;
      due = addDays(due, step);
    }
  }
  bills.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : b.amount - a.amount));
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);

  const toSetAside = Math.max(0, savingsGoal - invested);
  const left = cameIn - spent - moved - billsTotal - toSetAside;
  const daysLeft = Math.max(1, daysBetween(today, until));
  return {
    basis, from, until, daysLeft, pay,
    cameIn, spent, moved, invested, bills, billsTotal, toSetAside, left,
    perDay: left > 0 ? left / daysLeft : 0,
    used: (spent + moved + billsTotal + toSetAside) / cameIn,
    newest,
    behind: daysBetween(newest, today) > BEHIND_DAYS,
    payLate,
  };
}
