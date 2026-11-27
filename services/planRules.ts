/**
 * Essential and Plus, as wall-ette.com sells them (site/src/lib/plans.ts and
 * programs.ts): the products in Google Play, what each plan opens,
 * Essential's limits, and how a member moves between plans. Paid plans stay
 * switched off (config/app.plansLive) until the production release.
 *
 * Pure, with no imports, so the check scripts can test it in Node;
 * functions/src/plans.ts repeats the few constants the server needs, and
 * scripts/check-plans.mjs keeps the copies equal.
 */

export type PlanId = 'essential' | 'plus';
export type Cycle = 'monthly' | 'yearly';

// ── Google Play ──────────────────────────────────────────────────────────────

/** One subscription per plan in Play Console. Play never reuses an id. */
export const PLAY_PRODUCTS: Readonly<Record<PlanId, string>> = { essential: 'essential', plus: 'plus' };
/** Each subscription's base plans: essential-monthly, essential-yearly, plus-monthly, plus-yearly. */
export const basePlanId = (plan: PlanId, cycle: Cycle): string => `${plan}-${cycle}`;
/** The 30-day ₹0 offer on every base plan, for people who never had a subscription in the app. */
export const FREE_MONTH_OFFER = 'free-month';

/** The plan and period of a Play base plan id; null for anything else. */
export function planOfBasePlan(id: string | null | undefined): { plan: PlanId; cycle: Cycle } | null {
  const m = /^(essential|plus)-(monthly|yearly)$/.exec(id ?? '');
  return m ? { plan: m[1] as PlanId, cycle: m[2] as Cycle } : null;
}

// ── The terms (wall-ette.com/pricing) ────────────────────────────────────────

/** Rupees, as on wall-ette.com. Play shows its own price string, with any tax, at checkout. */
export const PRICES: Readonly<Record<PlanId, Readonly<Record<Cycle, number>>>> = {
  essential: { monthly: 49, yearly: 449 },
  plus: { monthly: 99, yearly: 899 },
};
export const TRIAL_DAYS = 30;
/** Moving down from Plus opens this many months after the membership started. */
export const MOVE_DOWN_AFTER_MONTHS = 12;
export const ESSENTIAL_LIMITS = { accounts: 1, historyMonths: 12 } as const;

/** Spread (wall-ette.com/spread). */
export const REFERRAL_REWARD_MONTHS = 1;
/** A friend's code counts for this long after they join. */
export const REFERRAL_WINDOW_DAYS = 30;
export const GIFT_MONTHS = 12;
export const STUDENT_MIN_AGE = 18;
/** Student access is checked again this often, and never runs past the course's end. */
export const STUDENT_RECHECK_MONTHS = 12;

// ── Who can do what ──────────────────────────────────────────────────────────

/**
 * What a member can do now:
 * - 'open': paid plans aren't switched on (config/app.plansLive), so
 *   everything is open, as before.
 * - 'plus', 'essential': their plan.
 * - 'none': no plan, never chosen or ended. Records stay readable,
 *   exportable and deletable; nothing new is added.
 */
export type Access = 'open' | 'plus' | 'essential' | 'none';

/** Only Plus opens these. */
export type PlusFeature = 'flow-story' | 'rewind' | 'recurring' | 'more-accounts' | 'full-history' | 'priority-support';

export type GrantSource = 'play' | 'web' | 'gift' | 'student' | 'reward' | 'early';

export type EntitlementState =
  | 'active' | 'grace' | 'on-hold' | 'paused' | 'canceled' | 'expired' | 'pending' | 'unknown';

/** entitlements/{uid}, written only by the server (functions/src/index.ts). */
export interface Entitlement {
  /** The plan open now; null when none is. */
  plan: PlanId | null;
  cycle: Cycle | null;
  /** Where the open plan comes from. */
  source: GrantSource | null;
  state: EntitlementState;
  /** End of the period paid or granted for, ISO 8601; null if open-ended. */
  expiresAt: string | null;
  /** In the free month. */
  trial: boolean;
  /** Google Play renews it at expiresAt unless cancelled. */
  autoRenewing: boolean;
  /** When this membership started; a restart starts it again. */
  memberSince: string | null;
  /** A move down or to monthly that starts at the next renewal; cycle is null when Play doesn't say. */
  pendingChange: { plan: PlanId; cycle: Cycle | null } | null;
  /** A licence tester's purchase: nothing was charged. */
  test: boolean;
}

/** A plan keeps working this long past its end date in case Play's renewal notice is late. */
export const RENEWAL_SLACK_MS = 3 * 24 * 60 * 60 * 1000;

export interface PlanFacts {
  /** config/app.plansLive. */
  live: boolean;
  entitlement: Entitlement | null;
  now: number;
}

export function accessOf(f: PlanFacts): Access {
  if (!f.live) return 'open';
  const e = f.entitlement;
  if (!e?.plan) return 'none';
  if (e.expiresAt) {
    const end = Date.parse(e.expiresAt);
    if (Number.isFinite(end) && f.now >= end + RENEWAL_SLACK_MS) return 'none';
  }
  return e.plan;
}

/** Past its end date by the server's last word: time to ask again. */
export function needsRefresh(f: PlanFacts): boolean {
  const end = f.entitlement?.plan && f.entitlement.expiresAt ? Date.parse(f.entitlement.expiresAt) : NaN;
  return f.live && Number.isFinite(end) && f.now >= end;
}

export const opens = (access: Access, _feature: PlusFeature): boolean => access === 'open' || access === 'plus';

/** New entries, imports and payments from apps. Export and deletion never depend on a plan. */
export const canAdd = (access: Access): boolean => access !== 'none';

// ── Essential's limits ───────────────────────────────────────────────────────

/** First day (YYYY-MM-DD) of Essential's history: this month and the 11 before it. */
export function historyStart(today: string, months: number = ESSENTIAL_LIMITS.historyMonths): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1 - (months - 1);
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/**
 * The bank account Essential keeps: the one with the earliest statement in
 * the wallet (accounts as services/accounts.ts keeps them), the first one
 * added when no day is known. Null while the wallet has none.
 */
export function essentialAccount(accounts: Readonly<Record<string, { asOf: string | null }>>): string | null {
  let best: { key: string; asOf: string } | null = null;
  const keys = Object.keys(accounts);
  for (const key of keys) {
    const asOf = accounts[key].asOf ?? '9999-12-31';
    if (!best || asOf < best.asOf) best = { key, asOf };
  }
  return best?.key ?? null;
}

export interface Limits {
  access: Access;
  /** historyStart(today), for Essential. */
  from: string;
  /** essentialAccount(…), for Essential. */
  account: string | null;
}

/**
 * Whether an entry can be changed. On Essential, entries older than its 12
 * months or in a second bank account stay, read-only, until Plus. Entries
 * that belong to no account (typed in, read from an app) count in Essential's.
 * With no plan, nothing is changed; deleting is always possible.
 */
export function editable(l: Limits, entry: { date: string; account: string }, other: string): boolean {
  if (l.access === 'open' || l.access === 'plus') return true;
  if (l.access === 'none') return false;
  if (entry.date.slice(0, 10) < l.from) return false;
  return entry.account === other || l.account === null || entry.account === l.account;
}

/** Whether Essential takes a statement of this account: its own, or the first. */
export const takesAccount = (l: Limits, key: string | null): boolean =>
  l.access !== 'essential' || key === null || l.account === null || key === l.account;

// ── Moving between plans ─────────────────────────────────────────────────────

export type ChangeKind =
  /** No plan yet: a new subscription, with the free month if Play offers it. */
  | 'start'
  /** Already this plan and period. */
  | 'same'
  /** Essential to Plus, same period: Plus now, the difference charged for the rest of the period. */
  | 'upgrade-now'
  /** Monthly to yearly, or Plus on another period: starts now at the full price; the unused time is added. */
  | 'switch-now'
  /** Plus to Essential, or yearly to monthly: starts at the next renewal. */
  | 'at-renewal'
  /** Plus to Essential within the first year. */
  | 'not-yet';

/** Google Play's subscription replacement mode for the change (@capgo/native-purchases). */
export type Replacement = 'CHARGE_PRORATED_PRICE' | 'CHARGE_FULL_PRICE' | 'DEFERRED';

export interface PlanChange {
  kind: ChangeKind;
  replacement?: Replacement;
  /** For 'not-yet': the day moving down opens, YYYY-MM-DD. */
  opensOn?: string;
}

/** Adds whole months to a YYYY-MM-DD day, keeping the day where the month has it. */
export function addMonths(day: string, months: number): string {
  const y = Number(day.slice(0, 4));
  const m0 = Number(day.slice(5, 7)) - 1 + months;
  const year = y + Math.floor(m0 / 12);
  const month = ((m0 % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = Math.min(Number(day.slice(8, 10)), last);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * How a member moves from their plan to another (wall-ette.com's rules):
 * moving up starts now, moving down waits for the renewal and, from Plus to
 * Essential, for the first year to pass. A change on both plan and period at
 * once counts as its upward part.
 */
export function changeOf(
  current: { plan: PlanId; cycle: Cycle; memberSince: string | null } | null,
  target: { plan: PlanId; cycle: Cycle },
  today: string,
): PlanChange {
  if (!current) return { kind: 'start' };
  if (current.plan === target.plan && current.cycle === target.cycle) return { kind: 'same' };
  if (current.plan === 'plus' && target.plan === 'essential') {
    const opensOn = current.memberSince ? addMonths(current.memberSince.slice(0, 10), MOVE_DOWN_AFTER_MONTHS) : null;
    if (opensOn && today < opensOn) return { kind: 'not-yet', opensOn };
    return { kind: 'at-renewal', replacement: 'DEFERRED' };
  }
  const tierUp = current.plan === 'essential' && target.plan === 'plus';
  if (!tierUp) {
    // Same plan, another period.
    return target.cycle === 'yearly'
      ? { kind: 'switch-now', replacement: 'CHARGE_FULL_PRICE' }
      : { kind: 'at-renewal', replacement: 'DEFERRED' };
  }
  return current.cycle === target.cycle
    ? { kind: 'upgrade-now', replacement: 'CHARGE_PRORATED_PRICE' }
    : { kind: 'switch-now', replacement: 'CHARGE_FULL_PRICE' };
}

/** Whole percent a yearly plan saves against twelve monthly payments. */
export const yearlySaving = (plan: PlanId): number =>
  Math.max(0, Math.floor((1 - PRICES[plan].yearly / (PRICES[plan].monthly * 12)) * 100));

// ── Codes (redeemed in Self → Your plan) ─────────────────────────────────────

/** Letters and digits that can't be misread for each other (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "w-7kq2 m9px" → "W7KQ2M9PX": what a member typed, ready to look up. */
export const normalizeCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A code as shown: groups of four, "W7KQ-2M9P". */
export const showCode = (code: string): string => normalizeCode(code).replace(/(.{4})(?=.)/g, '$1-');

/** Plausibly a code: 6 to 16 characters of the alphabet. */
export const looksLikeCode = (raw: string): boolean => {
  const c = normalizeCode(raw);
  return c.length >= 6 && c.length <= 16 && [...c].every(ch => CODE_ALPHABET.includes(ch));
};
