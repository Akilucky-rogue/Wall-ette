/**
 * What a Google Play subscription to Essential or Plus gives its owner.
 * Pure, so scripts/check-plan-server.mjs can test it in Node without Google.
 *
 * Input is the part of `purchases.subscriptionsv2.get` (SubscriptionPurchaseV2)
 * this needs; output is the `play` grant (entitlements/{uid}/grants/play).
 */
import { createHash } from 'node:crypto';
import { isPlayProduct, planOfBasePlan, type Cycle, type PlanId } from './plans.js';

export interface PlaySubscription {
  subscriptionState?: string | null;
  acknowledgementState?: string | null;
  linkedPurchaseToken?: string | null;
  startTime?: string | null;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string | null } | null;
  testPurchase?: object | null;
  lineItems?: Array<{
    productId?: string | null;
    expiryTime?: string | null;
    autoRenewingPlan?: { autoRenewEnabled?: boolean | null } | null;
    offerDetails?: { basePlanId?: string | null; offerId?: string | null } | null;
    offerPhase?: { freeTrial?: object | null } | null;
    deferredItemReplacement?: { productId?: string | null } | null;
  }> | null;
}

export type GrantSource = 'play' | 'web' | 'gift' | 'student' | 'reward' | 'early';
export type GrantState = 'active' | 'grace' | 'on-hold' | 'paused' | 'canceled' | 'expired' | 'pending' | 'unknown';

/** One source of a plan: entitlements/{uid}/grants/{source}. */
export interface Grant {
  source: GrantSource;
  plan: PlanId;
  cycle: Cycle | null;
  /** Gives the plan now (for Play, by Play's state when last read). */
  open: boolean;
  state: GrantState;
  /** End of the period paid or granted for, ISO 8601; null if open-ended. */
  expiresAt: string | null;
  trial: boolean;
  autoRenewing: boolean;
  /** When this membership started. */
  startedAt: string | null;
  /** Play: when its first paid period was first seen (after any free month). */
  firstPaidAt?: string | null;
  /** A move down or to monthly waiting for the renewal. */
  pendingChange: { plan: PlanId; cycle: Cycle | null } | null;
  test: boolean;
}

const STATES: Record<string, GrantState> = {
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
  SUBSCRIPTION_STATE_ON_HOLD: 'on-hold',
  SUBSCRIPTION_STATE_PAUSED: 'paused',
  SUBSCRIPTION_STATE_CANCELED: 'canceled',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
  SUBSCRIPTION_STATE_PENDING: 'pending',
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
};

/**
 * The `play` grant. Active and in grace are paid for (in grace Play is
 * retrying a failed payment, and access continues). Cancelled keeps access
 * until the end of the period already paid. On hold, paused, pending and
 * expired don't. Null when the purchase holds neither plan.
 *
 * `sameMembership` is the grant this purchase continues: the same purchase
 * read before, or the one an upgrade replaced. It keeps the membership's
 * start and its first paid day; a new subscription after one ended starts
 * again from month one (wall-ette.com's restart rule).
 */
export function playGrantOf(sub: PlaySubscription, now: Date, sameMembership: Grant | null = null): Grant | null {
  const items = (sub.lineItems ?? []).filter(i => isPlayProduct(i.productId));
  const latest = items.reduce<(typeof items)[number] | null>((best, i) => {
    const t = Date.parse(i.expiryTime ?? '');
    const b = best ? Date.parse(best.expiryTime ?? '') : NaN;
    return !best || (Number.isFinite(t) && (!Number.isFinite(b) || t > b)) ? i : best;
  }, null);
  if (!latest) return null;
  const expiry = Date.parse(latest.expiryTime ?? '');
  const state = STATES[sub.subscriptionState ?? ''] ?? 'unknown';
  const paidUntilLater = Number.isFinite(expiry) && expiry > now.getTime();
  const open = state === 'active' || state === 'grace' || (state === 'canceled' && paidUntilLater);
  const trial = Boolean(latest.offerPhase?.freeTrial);
  const base = planOfBasePlan(latest.offerDetails?.basePlanId);
  const replacement = latest.deferredItemReplacement?.productId;
  const startedAt = sub.startTime ? new Date(Date.parse(sub.startTime)).toISOString() : null;
  return {
    source: 'play',
    plan: latest.productId as PlanId,
    cycle: base?.cycle ?? null,
    open,
    state,
    expiresAt: Number.isFinite(expiry) ? new Date(expiry).toISOString() : null,
    trial,
    autoRenewing: latest.autoRenewingPlan?.autoRenewEnabled === true,
    startedAt: sameMembership?.startedAt ?? startedAt,
    firstPaidAt: sameMembership?.firstPaidAt ?? (open && !trial ? now.toISOString() : null),
    pendingChange: isPlayProduct(replacement) ? { plan: replacement, cycle: null } : null,
    test: Boolean(sub.testPurchase),
  };
}

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * The account id the app gives Play when buying (`appAccountToken`, kept by
 * Play as obfuscatedExternalAccountId): 64 hex characters, which Play
 * allows, and no personal data. The app computes the same (services/billing.ts).
 */
export const accountIdOf = (uid: string): string => sha256(uid);

/** Document id for a purchase token: tokens can be long and contain '/'. */
export const tokenKey = (token: string): string => sha256(token);

export type Ownership = 'ok' | 'other-account' | 'other-user';

/**
 * Whether this user may claim this purchase: it must have been bought for
 * them (when Play recorded an account id), and not already be claimed by
 * someone else.
 */
export function ownership(sub: PlaySubscription, uid: string, claimedBy: string | null): Ownership {
  const boughtFor = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null;
  if (boughtFor && boughtFor !== accountIdOf(uid)) return 'other-account';
  if (claimedBy && claimedBy !== uid) return 'other-user';
  return 'ok';
}

/** Play refunds a purchase that isn't acknowledged within 3 days. */
export const needsAcknowledging = (sub: PlaySubscription): boolean =>
  sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING'
  && (sub.subscriptionState === 'SUBSCRIPTION_STATE_ACTIVE' || sub.subscriptionState === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD');

/** The product of the line item to acknowledge or defer: the latest of ours. */
export function productOf(sub: PlaySubscription): PlanId | null {
  const ours = (sub.lineItems ?? []).filter(i => isPlayProduct(i.productId));
  const latest = ours.sort((a, b) => Date.parse(b.expiryTime ?? '') - Date.parse(a.expiryTime ?? ''))[0];
  return (latest?.productId as PlanId | undefined) ?? null;
}
