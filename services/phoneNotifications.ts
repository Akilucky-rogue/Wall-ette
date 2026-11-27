/**
 * Phone notifications: what Wall-ette shows in Android's notification shade,
 * made on the phone from data the app already has (the posting is in
 * services/phoneNotifier.ts). Nothing is sent anywhere.
 *
 *   - Bills: a reminder the evening before a recurring charge is due (18:00),
 *     or that morning (09:00) when the evening has passed, for charges due in
 *     the next week. Planned again whenever the data changes, so a bill that
 *     has been paid, or has stopped, loses its reminder.
 *   - Alerts: the bell's budget and daily-limit notes (services/notifications.ts),
 *     each shown once, when it first appears. Switching phone notifications on
 *     counts the ones already there as shown, so turning it on doesn't bring a
 *     burst of old news.
 *
 * Off until switched on in Self → Alerts and limits. The switch and the
 * record of what was shown stay on this device under keys ending in `_<uid>`,
 * which sign-out removes (services/session.ts).
 *
 * No React or Capacitor here, so scripts/check-phone-notifications.mjs runs it in Node.
 */
import { AppScreen, Transaction } from '../types';
import { detectRecurringCharges, normalizeMerchant, prettyMerchant } from './analyticsService';
import { budgetAlerts, type AppNotification } from './notifications';
import { addDays, localDay, parseDay } from '../utils/dates';
import type { ScreenSection } from '../utils/screenSection';

export interface PhoneNote {
  /** What it is about: 'bill:<payee>:<day>', or the bell's id for an alert. */
  key: string;
  /** The number Android knows it by. */
  id: number;
  kind: 'bill' | 'alert';
  title: string;
  body: string;
  /** When to show it; null shows it now. */
  at: Date | null;
  /** Where tapping it opens. */
  screen: AppScreen;
  section?: ScreenSection;
}

/** Bills due this many days ahead get a reminder. */
const BILL_AHEAD_DAYS = 7;
/** At most this many bill reminders wait at once. */
const MAX_BILLS = 8;
const EVENING_HOUR = 18;
const MORNING_HOUR = 9;
/** Records of alerts already shown are kept this long. */
const KEEP_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const daysBetween = (from: string, to: string): number =>
  Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

const atHour = (day: string, hour: number): Date => {
  const d = parseDay(day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/**
 * A positive 31-bit number for a key (FNV-1a), stable across runs, so the
 * same reminder planned twice replaces itself instead of doubling.
 */
export function notificationNumber(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

/** Reminders for recurring charges due in the next week, the evening before (or that morning). */
export function billReminders(counted: Transaction[], now: Date, money: (n: number) => string): PhoneNote[] {
  const today = localDay(now);
  const notes: PhoneNote[] = [];
  for (const r of detectRecurringCharges(counted, now, Infinity)) {
    const due = localDay(r.nextExpected);
    if (due < today || daysBetween(today, due) > BILL_AHEAD_DAYS) continue;
    const evening = atHour(addDays(due, -1), EVENING_HOUR);
    const morning = atHour(due, MORNING_HOUR);
    const at = evening > now ? evening : morning > now ? morning : null;
    if (!at) continue; // due today and the morning has passed: the bell has it
    const key = `bill:${normalizeMerchant(r.name) || r.category}:${due}`;
    notes.push({
      key,
      id: notificationNumber(key),
      kind: 'bill',
      title: `${prettyMerchant(r.name)} is due ${at === evening ? 'tomorrow' : 'today'}`,
      body: `Usually about ${money(r.amount)}, going by your past payments.`,
      at,
      screen: AppScreen.PULSE_RECURRING,
    });
  }
  return notes
    .sort((a, b) => a.at!.getTime() - b.at!.getTime())
    .slice(0, MAX_BILLS);
}

export interface AlertInput {
  counted: Transaction[];
  budgets: Record<string, number>;
  dailyLimit: number;
  now: Date;
  money: (n: number) => string;
}

/** The bell's budget and daily-limit notes, as phone notifications. */
export function currentAlerts(input: AlertInput): PhoneNote[] {
  return budgetAlerts(input).map((n: AppNotification) => ({
    key: n.id,
    id: notificationNumber(n.id),
    kind: 'alert' as const,
    title: n.title,
    body: n.body,
    at: null,
    screen: n.action.kind === 'screen' ? n.action.screen : AppScreen.DASHBOARD,
    section: n.action.kind === 'screen' ? n.action.section : undefined,
  }));
}

// ── What this device has switched on and shown ───────────────────────────

/** key → when it was shown on the phone (ms). */
export type ShownRecord = Record<string, number>;

export const phoneKeys = (uid: string) => ({
  on: `walletPhoneNotify_${uid}`,
  shown: `walletPhoneShown_${uid}`,
});

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): Store | null => (typeof localStorage === 'undefined' ? null : localStorage);

export function phoneNotificationsOn(uid: string, storage: Store | null = store()): boolean {
  try { return storage?.getItem(phoneKeys(uid).on) === '1'; } catch { return false; }
}

const switchListeners = new Set<() => void>();

/** Calls `listener` whenever the switch changes; returns a remover (for useSyncExternalStore). */
export function subscribePhoneSwitch(listener: () => void): () => void {
  switchListeners.add(listener);
  return () => { switchListeners.delete(listener); };
}

export function setPhoneNotificationsOn(uid: string, on: boolean, storage: Store | null = store()): void {
  try {
    if (on) storage?.setItem(phoneKeys(uid).on, '1');
    else storage?.removeItem(phoneKeys(uid).on);
  } catch { /* storage unavailable */ }
  switchListeners.forEach(l => l());
}

export function loadShown(uid: string, storage: Store | null = store()): ShownRecord {
  try {
    const raw = storage?.getItem(phoneKeys(uid).shown);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function saveShown(uid: string, shown: ShownRecord, storage: Store | null = store()): void {
  try { storage?.setItem(phoneKeys(uid).shown, JSON.stringify(shown)); } catch { /* storage unavailable */ }
}

/** Alerts not shown on the phone yet. */
export const newAlerts = (alerts: PhoneNote[], shown: ShownRecord): PhoneNote[] =>
  alerts.filter(a => !(a.key in shown));

/** `shown` with `keys` added at `at`, and records older than two months dropped. */
export function markShown(shown: ShownRecord, keys: string[], at: number): ShownRecord {
  const next: ShownRecord = {};
  for (const [k, when] of Object.entries(shown)) if (at - when < KEEP_DAYS * DAY_MS) next[k] = when;
  for (const k of keys) next[k] = next[k] ?? at;
  return next;
}
