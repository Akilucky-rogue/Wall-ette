/**
 * In-app notifications: the bell on Home (components/NotificationCenter.tsx).
 *
 * Built on the phone from what the app already holds: transactions, budgets,
 * the daily limit and savings goal, the security log of unlock attempts and
 * the update state. Nothing new is collected or sent anywhere.
 *
 * Each notification's id names what it is about (a budget and month, a
 * charge's day, a failed unlock's time), so the bell can tell new ones from
 * ones already seen, and a budget going over after nearing its limit is news
 * again. Seen and dismissed ids stay on this device under a key ending in
 * `_<uid>`, which sign-out removes with the rest of the user's data
 * (services/session.ts).
 *
 * No React or Firebase here, so scripts/check-notifications.mjs runs it in Node.
 */
import { AppScreen, Transaction, TransactionType } from '../types';
import { detectRecurringCharges, normalizeMerchant, prettyMerchant, priceRises } from './analyticsService';
import { walletCopies } from './statementImport';
import { addDays, isDay, localDay, parseDay } from '../utils/dates';
import type { ScreenSection } from '../utils/screenSection';

export type NotificationTone = 'alert' | 'warn' | 'good' | 'info';

export type NotificationAction =
  | { kind: 'screen'; screen: AppScreen; section?: ScreenSection }
  | { kind: 'restart' }
  /** Google Play's update (services/appUpdates.ts installUpdate). */
  | { kind: 'update' }
  | { kind: 'whatsNew' };

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  /** A Material Symbols name. */
  icon: string;
  title: string;
  body: string;
  /** When it happened, for a notification about one event. */
  at?: Date;
  action: NotificationAction;
  /** Order in the list: lower comes first. */
  rank: number;
}

/** One lock-screen attempt from the security log (components/SecurityLock.tsx). */
export interface UnlockEvent {
  at: Date;
  ok: boolean;
  method?: string;
}

export interface NotificationInput {
  now: Date;
  /** Every transaction: for how recent the data is, and entries in twice. */
  transactions: Transaction[];
  /** Spending and income only, money moved left out (WalletContext's `counted`). */
  counted: Transaction[];
  /** Monthly budget per category, in the base currency. */
  budgets: Record<string, number>;
  dailyLimit: number;
  savingsGoal: number;
  /** Recent lock-screen attempts, in any order. */
  unlocks: UnlockEvent[];
  /** A downloaded update is waiting for a restart. */
  updateReady: boolean;
  /**
   * The versionCode Google Play offers, not yet downloading or downloaded
   * (0 when there's none). Listed even after "No thanks" in Google's dialog.
   */
  updateAvailable?: number;
  /** The running version, with the first line of its release notes if it has any. */
  release: { versionCode: number; version: string; first: string | null };
  /** An amount in the base currency as the app shows it, without paise. */
  money: (amountInBase: number) => string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A price rise is news while the charge is this recent. */
const RECENT_DAYS = 45;
/** How far ahead a recurring charge counts as due soon. */
const DUE_AHEAD_DAYS = 3;
/** The import reminder appears when the newest entry is this old. */
const STALE_DAYS = 30;
/** Failed unlocks older than this are left out. */
const SECURITY_DAYS = 14;
/** A wrong password followed this soon by an unlock was a typo, not news. */
const TYPO_GRACE_MS = 5 * 60 * 1000;
/** A budget this full is nearly used up. */
const NEAR_BUDGET = 0.8;
const MAX_SHOWN = 20;

const RANK = {
  security: 0, overBudget: 10, overLimit: 11, copies: 20, creep: 23,
  due: 30, nearBudget: 31, stale: 40, goal: 50, update: 60, release: 61,
} as const;

/** Who a narration pays, as the screens show it. */
const payee = (raw: string): string => prettyMerchant(raw);
const dayOf = (t: Transaction): string => (isDay(t.date) ? t.date : localDay(parseDay(t.date)));
const shortDay = (d: Date): string => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const monthName = (d: Date): string => d.toLocaleString('en-GB', { month: 'long' });
const clock = (d: Date): string => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const plural = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);

/** "today at 23:14", "yesterday at 09:02", "on 12 Nov at 18:40". */
export function whenSaid(at: Date, now: Date): string {
  const days = Math.round((parseDay(localDay(now)).getTime() - parseDay(localDay(at)).getTime()) / DAY_MS);
  const day = days === 0 ? 'today' : days === 1 ? 'yesterday' : `on ${shortDay(at)}`;
  return `${day} at ${clock(at)}`;
}

/** Whole days from `from` to `to`, two 'YYYY-MM-DD' days. */
const daysBetween = (from: string, to: string): number =>
  Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

function securityNotes({ unlocks, now }: NotificationInput): AppNotification[] {
  const since = now.getTime() - SECURITY_DAYS * DAY_MS;
  const unlocked = unlocks.filter(u => u.ok).map(u => u.at.getTime());
  const failed = unlocks
    .filter(u => !u.ok && u.at.getTime() >= since)
    .filter(u => !unlocked.some(t => t > u.at.getTime() && t - u.at.getTime() <= TYPO_GRACE_MS))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  if (failed.length === 0) return [];

  const n = failed.length;
  const last = failed[0].at;
  const codes = failed.filter(f => f.method === 'MFA').length;
  const what = codes === 0 ? plural(n, 'password') : codes === n ? plural(n, 'code') : 'passwords or codes';
  return [{
    id: `security:${last.getTime()}`,
    tone: 'alert',
    icon: 'gpp_maybe',
    title: n === 1 ? 'Failed unlock attempt' : `${n} failed unlock attempts`,
    body: n === 1
      ? `A wrong ${what} was entered on the lock screen ${whenSaid(last, now)}. If that wasn't you, tap to change your password.`
      : `Wrong ${what} were entered on the lock screen, most recently ${whenSaid(last, now)}. If that wasn't you, tap to change your password.`,
    at: last,
    action: { kind: 'screen', screen: AppScreen.SELF_ACCOUNT },
    rank: RANK.security,
  }];
}

function budgetNotes({ counted, budgets, dailyLimit, now, money }: NotificationInput): AppNotification[] {
  const today = localDay(now);
  const month = today.slice(0, 7);
  const spent = new Map<string, number>();
  let spentToday = 0;
  for (const t of counted) {
    if (t.type !== TransactionType.EXPENSE) continue;
    const day = dayOf(t);
    if (day.slice(0, 7) !== month) continue;
    spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount);
    if (day === today) spentToday += t.amount;
  }

  const notes: AppNotification[] = [];
  const name = monthName(now);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const left = daysLeft === 0
    ? `on the last day of ${name}`
    : `with ${daysLeft} ${plural(daysLeft, 'day')} left in ${name}`;

  const rows = Object.entries(budgets)
    .filter(([, budget]) => budget > 0)
    .map(([category, budget]) => ({ category, budget, used: spent.get(category) ?? 0 }))
    .filter(r => r.used >= r.budget * NEAR_BUDGET)
    .sort((a, b) => b.used / b.budget - a.used / a.budget);
  for (const { category, budget, used } of rows) {
    const over = used > budget;
    notes.push({
      id: `budget:${category}:${month}:${over ? 'over' : 'near'}`,
      tone: over ? 'alert' : 'warn',
      icon: over ? 'error' : 'data_usage',
      title: over ? `${category} is over budget` : `${category} budget ${Math.floor((used / budget) * 100)}% used`,
      body: over
        ? `${money(used)} spent in ${name} against a ${money(budget)} budget, ${money(used - budget)} over.`
        : `${money(used)} of ${money(budget)} spent, ${left}.`,
      action: { kind: 'screen', screen: AppScreen.INCOME_INSIGHTS, section: 'goals' },
      rank: over ? RANK.overBudget : RANK.nearBudget,
    });
  }

  if (dailyLimit > 0 && spentToday > dailyLimit) {
    notes.push({
      id: `limit:${today}`,
      tone: 'alert',
      icon: 'speed',
      title: "Over today's limit",
      body: `${money(spentToday)} spent today, ${money(spentToday - dailyLimit)} more than your ${money(dailyLimit)} daily limit.`,
      action: { kind: 'screen', screen: AppScreen.ANALYSIS },
      rank: RANK.overLimit,
    });
  }
  return notes;
}

function walletNotes({ transactions, counted, now, money }: NotificationInput): AppNotification[] {
  const notes: AppNotification[] = [];
  const from = addDays(localDay(now), -RECENT_DAYS);

  // Entries imported twice change the balance; Vault removes the copies.
  const { copies, groups } = walletCopies(transactions);
  if (copies.length > 0) {
    let net = 0;
    for (const t of copies) net += t.type === TransactionType.INCOME ? t.amount : -t.amount;
    // One extra copy each: "twice"; any group with more: "more than once".
    const times = copies.length === groups ? 'twice' : 'more than once';
    notes.push({
      id: `copies:${copies.length}:${Math.round(net)}`,
      tone: 'warn',
      icon: 'content_copy',
      title: groups === 1 ? `A transaction is in your wallet ${times}` : `${groups} transactions are in your wallet ${times}`,
      body: `Usually from importing an overlapping statement. ${Math.abs(net) >= 1 ? `They change your balance by ${money(Math.abs(net))}. ` : ''}Remove the extra copies in Vault.`,
      action: { kind: 'screen', screen: AppScreen.HISTORY },
      rank: RANK.copies,
    });
  }

  // A subscription or bill that went up, while it's still being charged.
  for (const rise of priceRises(counted).slice(0, 2)) {
    if (rise.lastDay < from) continue;
    notes.push({
      id: `creep:${rise.key}:${Math.round(rise.to)}`,
      tone: 'warn',
      icon: 'trending_up',
      title: `${payee(rise.name)} costs more`,
      body: `Up from ${money(rise.from)} to ${money(rise.to)} a month, about ${money(rise.annualExtra)} more a year.`,
      action: { kind: 'screen', screen: AppScreen.PULSE_RECURRING },
      rank: RANK.creep,
    });
  }
  return notes;
}

const CADENCE: Record<string, string> = {
  WEEKLY: 'a week', BIWEEKLY: 'every two weeks', MONTHLY: 'a month', YEARLY: 'a year',
};

function dueNotes({ counted, now, money }: NotificationInput): AppNotification[] {
  const today = localDay(now);
  return detectRecurringCharges(counted, now, Infinity)
    .map(r => ({ r, day: localDay(r.nextExpected) }))
    .filter(({ day }) => day >= today && daysBetween(today, day) <= DUE_AHEAD_DAYS)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : b.r.amount - a.r.amount))
    .slice(0, 3)
    .map(({ r, day }) => {
      const inDays = daysBetween(today, day);
      const when = inDays === 0 ? 'today' : inDays === 1 ? 'tomorrow' : `on ${shortDay(parseDay(day))}`;
      return {
        id: `due:${normalizeMerchant(r.name) || r.category}:${day}`,
        tone: 'info' as const,
        icon: 'event_upcoming',
        title: `${payee(r.name)} is due ${when}`,
        body: `Usually about ${money(r.amount)} ${CADENCE[r.cadence] ?? ''}`.trim() + '.',
        action: { kind: 'screen' as const, screen: AppScreen.PULSE_RECURRING },
        rank: RANK.due,
      };
    });
}

function dataNotes({ transactions, counted, savingsGoal, now, money }: NotificationInput): AppNotification[] {
  if (transactions.length === 0) return [];
  const notes: AppNotification[] = [];
  const today = localDay(now);
  const newest = transactions.reduce((d, t) => { const day = dayOf(t); return day > d ? day : d; }, '');

  if (daysBetween(newest, today) >= STALE_DAYS) {
    notes.push({
      id: `stale:${today.slice(0, 7)}`,
      tone: 'info',
      icon: 'upload_file',
      title: 'Time to import a statement',
      body: `Your newest entry is from ${shortDay(parseDay(newest))}. Import your latest statement to keep Home, Pulse and Flow up to date.`,
      action: { kind: 'screen', screen: AppScreen.IMPORT },
      rank: RANK.stale,
    });
  }

  // Last month's savings, once the data reaches into this month (so the
  // month is complete).
  const thisMonth = today.slice(0, 7);
  if (savingsGoal > 0 && newest.slice(0, 7) >= thisMonth) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = localDay(prev).slice(0, 7);
    let saved = 0;
    let any = false;
    for (const t of counted) {
      if (dayOf(t).slice(0, 7) !== prevMonth) continue;
      any = true;
      saved += t.type === TransactionType.INCOME ? t.amount : -t.amount;
    }
    if (any) {
      const met = saved >= savingsGoal;
      const name = monthName(prev);
      notes.push({
        id: `goal:${prevMonth}`,
        tone: met ? 'good' : 'info',
        icon: met ? 'savings' : 'flag',
        title: met ? `You met your savings goal in ${name}` : `${name}'s savings: ${money(saved)}`,
        body: met
          ? `${money(saved)} saved against a goal of ${money(savingsGoal)}.`
          : `${money(savingsGoal - saved)} short of your ${money(savingsGoal)} goal.`,
        action: { kind: 'screen', screen: AppScreen.INCOME_INSIGHTS, section: 'goals' },
        rank: RANK.goal,
      });
    }
  }
  return notes;
}

function appNotes({ updateReady, updateAvailable = 0, release }: NotificationInput): AppNotification[] {
  const notes: AppNotification[] = [];
  if (updateReady) {
    notes.push({
      id: `update:${release.versionCode}`,
      tone: 'info',
      icon: 'system_update',
      title: 'Update ready',
      body: 'Restart Wall-ette to finish installing the new version.',
      action: { kind: 'restart' },
      rank: RANK.update,
    });
  } else if (updateAvailable > release.versionCode) {
    notes.push({
      id: `update-available:${updateAvailable}`,
      tone: 'info',
      icon: 'system_update',
      title: 'Update available',
      body: 'A newer Wall-ette is on Google Play. Tap to update.',
      action: { kind: 'update' },
      rank: RANK.update,
    });
  }
  if (release.first) {
    notes.push({
      id: `release:${release.versionCode}`,
      tone: 'good',
      icon: 'auto_awesome',
      title: `What's new in ${release.version}`,
      body: release.first,
      action: { kind: 'whatsNew' },
      rank: RANK.release,
    });
  }
  return notes;
}

/** Every notification that applies now, most important first. */
/**
 * Budgets nearly used or over this month, and today's spending over the
 * daily limit: the notes the phone can also show as alerts
 * (services/phoneNotifications.ts).
 */
export const budgetAlerts = (input: Pick<NotificationInput, 'counted' | 'budgets' | 'dailyLimit' | 'now' | 'money'>): AppNotification[] =>
  budgetNotes(input as NotificationInput);

export function buildNotifications(input: NotificationInput): AppNotification[] {
  return [
    ...securityNotes(input),
    ...budgetNotes(input),
    ...walletNotes(input),
    ...dueNotes(input),
    ...dataNotes(input),
    ...appNotes(input),
  ]
    .sort((a, b) => a.rank - b.rank || (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0))
    .slice(0, MAX_SHOWN);
}

// ── What this device has seen ─────────────────────────────────────────────

export interface NotificationState {
  /** id → when it was first seen (ms). */
  seen: Record<string, number>;
  /** id → when it was dismissed (ms). */
  dismissed: Record<string, number>;
}

/** Seen notifications stay under "Earlier" this long. */
const EARLIER_DAYS = 14;
/** Records of notifications that no longer apply are dropped after this long. */
const KEEP_DAYS = 60;

export const emptyState = (): NotificationState => ({ seen: {}, dismissed: {} });

/** Ends in `_<uid>`, so sign-out removes it (services/session.ts). */
export const storageKey = (uid: string): string => `walletNotifications_${uid}`;

export function loadState(uid: string, storage: Pick<Storage, 'getItem'> = localStorage): NotificationState {
  try {
    const raw = JSON.parse(storage.getItem(storageKey(uid)) ?? 'null');
    if (raw && typeof raw.seen === 'object' && typeof raw.dismissed === 'object') {
      return { seen: { ...raw.seen }, dismissed: { ...raw.dismissed } };
    }
  } catch { /* storage unavailable or damaged */ }
  return emptyState();
}

export function saveState(uid: string, state: NotificationState, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try { storage.setItem(storageKey(uid), JSON.stringify(state)); } catch { /* storage unavailable */ }
}

/** Not seen yet ("New"), and seen in the last two weeks ("Earlier"); dismissed ones left out. */
export function arrange(list: AppNotification[], state: NotificationState, now: number): { fresh: AppNotification[]; earlier: AppNotification[] } {
  const fresh: AppNotification[] = [];
  const earlier: AppNotification[] = [];
  for (const n of list) {
    if (n.id in state.dismissed) continue;
    const seenAt = state.seen[n.id];
    if (seenAt === undefined) fresh.push(n);
    else if (now - seenAt <= EARLIER_DAYS * DAY_MS) earlier.push(n);
  }
  return { fresh, earlier };
}

/** Records `ids` as seen now, keeping when each was first seen. */
export function markSeen(state: NotificationState, ids: string[], now: number): NotificationState {
  const seen = { ...state.seen };
  for (const id of ids) if (seen[id] === undefined) seen[id] = now;
  return { ...state, seen };
}

export function dismiss(state: NotificationState, id: string, now: number): NotificationState {
  return { seen: { ...state.seen, [id]: state.seen[id] ?? now }, dismissed: { ...state.dismissed, [id]: now } };
}

/** Drops records older than two months, unless the notification still applies. */
export function prune(state: NotificationState, current: string[], now: number): NotificationState {
  const live = new Set(current);
  const keep = (record: Record<string, number>) =>
    Object.fromEntries(Object.entries(record).filter(([id, at]) => live.has(id) || now - at <= KEEP_DAYS * DAY_MS));
  return { seen: keep(state.seen), dismissed: keep(state.dismissed) };
}
