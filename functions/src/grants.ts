/**
 * A member's plan from all its sources. Pure, so scripts/check-plan-server.mjs
 * can test it in Node.
 *
 * entitlements/{uid}/grants/{source} holds each source: Google Play, a gift,
 * student access, a referral reward, an early-member grant, a web
 * subscription. entitlements/{uid} is their summary, the one document the app
 * reads (services/planRules.ts Entitlement): the best plan open now.
 */
import { addMonths, type Cycle, type PlanId } from './plans.js';
import type { Grant, GrantState } from './entitlement.js';

/** services/planRules.ts Entitlement. */
export interface Summary {
  plan: PlanId | null;
  cycle: Cycle | null;
  source: Grant['source'] | null;
  state: GrantState;
  expiresAt: string | null;
  trial: boolean;
  autoRenewing: boolean;
  memberSince: string | null;
  pendingChange: { plan: PlanId; cycle: Cycle | null } | null;
  test: boolean;
}

const time = (iso: string | null): number => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);

/** A grant gives its plan now: Play by its state when last read, the rest until they end. */
export function isOpen(g: Grant, now: Date): boolean {
  if (g.source === 'play' || g.source === 'web') return g.open;
  return g.open && time(g.expiresAt) > now.getTime();
}

const rank = (g: Grant): number => (g.plan === 'plus' ? 2 : 1);

/**
 * The best open grant: Plus over Essential, then the one that runs longest.
 * The membership's start comes from what's paid for (Play, the web), so
 * moving down after the first year counts from joining, not from a gift.
 */
export function summarize(grants: readonly Grant[], now: Date): Summary {
  const open = grants.filter(g => isOpen(g, now));
  const best = open.reduce<Grant | null>((b, g) => (!b || rank(g) > rank(b) || (rank(g) === rank(b) && time(g.expiresAt) > time(b.expiresAt)) ? g : b), null);
  const paid = open.find(g => g.source === 'play') ?? open.find(g => g.source === 'web') ?? null;
  if (!best) {
    const last = grants.reduce<Grant | null>((b, g) => (!b || time(g.expiresAt) > time(b.expiresAt) ? g : b), null);
    return {
      plan: null, cycle: null, source: null, state: last?.state === 'pending' ? 'pending' : last ? 'expired' : 'unknown',
      expiresAt: last?.expiresAt ?? null, trial: false, autoRenewing: false, memberSince: null, pendingChange: null, test: false,
    };
  }
  return {
    plan: best.plan,
    cycle: best.cycle,
    source: best.source,
    state: best.state,
    expiresAt: best.expiresAt,
    trial: best.trial,
    autoRenewing: best.autoRenewing,
    memberSince: (paid ?? best).startedAt,
    pendingChange: best.pendingChange,
    test: best.test,
  };
}

/** A grant that isn't from a store: open from now (or from when it ends, if it's running) for `months`. */
export function extendedGrant(
  source: Exclude<Grant['source'], 'play' | 'web'>,
  plan: PlanId,
  months: number,
  existing: Grant | null,
  now: Date,
  endsBy: Date | null = null,
): Grant {
  const running = existing && existing.plan === plan && isOpen(existing, now) && existing.expiresAt ? new Date(existing.expiresAt) : now;
  let end = addMonths(running > now ? running : now, months);
  if (endsBy && end > endsBy) end = endsBy;
  return {
    source,
    plan,
    cycle: null,
    open: true,
    state: 'active',
    expiresAt: end.toISOString(),
    trial: false,
    autoRenewing: false,
    startedAt: existing && isOpen(existing, now) ? existing.startedAt : now.toISOString(),
    pendingChange: null,
    test: false,
  };
}

/** Whether a member has ever paid: a Play or web membership past its free month. */
export const everPaid = (grants: readonly Grant[]): boolean =>
  grants.some(g => (g.source === 'play' || g.source === 'web') && Boolean(g.firstPaidAt));

/**
 * The friend's first paid month is done: they've paid for at least
 * `days` days and their membership is still open (not refunded or ended).
 */
export function firstPaidMonthDone(grants: readonly Grant[], now: Date, days: number): boolean {
  return grants.some(g => (g.source === 'play' || g.source === 'web') && isOpen(g, now) && Boolean(g.firstPaidAt)
    && now.getTime() - Date.parse(g.firstPaidAt as string) >= days * 24 * 60 * 60 * 1000);
}

/**
 * How a referral month reaches a member: added to their Google Play
 * subscription (Play moves the next charge a month later), or as a `reward`
 * grant of their current plan (Essential if they have none).
 */
export type RewardRoute = { kind: 'play' } | { kind: 'grant'; plan: PlanId };
export function rewardRoute(grants: readonly Grant[], now: Date): RewardRoute {
  const play = grants.find(g => g.source === 'play' && isOpen(g, now) && g.autoRenewing);
  if (play) return { kind: 'play' };
  const s = summarize(grants, now);
  return { kind: 'grant', plan: s.plan ?? 'essential' };
}
