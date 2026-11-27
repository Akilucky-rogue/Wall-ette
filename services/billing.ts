/**
 * Essential and Plus through Google Play (Android), checked by Wall-ette's
 * server (functions/src/index.ts, docs/PLAN_1.6.0.md).
 *
 * The app never decides on its own that someone has a plan: every purchase
 * token goes to verifyPlayPurchase, which asks Google Play, acknowledges the
 * purchase and writes entitlements/{uid}. services/plan.ts reads that.
 * Moving between plans replaces the Play subscription in place, with the
 * replacement mode planRules.ts changeOf gives (up now, down at renewal).
 */
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { getApp } from 'firebase/app';
import { log } from '../utils/log';
import { holdLock, releaseLock, skipLockOnce } from '../utils/externalFlow';
import {
  changeOf, PLAY_PRODUCTS, planOfBasePlan, FREE_MONTH_OFFER,
  type Cycle, type Entitlement, type PlanId,
} from './planRules';

/** Where the functions run (functions/src/index.ts setGlobalOptions). */
const REGION = 'asia-south1';

/** Google Play Billing: Android builds only. The web app says how to subscribe instead. */
export const billingSupported = (): boolean => Capacitor.getPlatform() === 'android';

export async function callFunction<T>(name: string, data?: unknown): Promise<T> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<unknown, T>(getFunctions(getApp(), REGION), name);
  return (await fn(data)).data;
}

/**
 * SHA-256 of the uid, in hex: the account id given to Play with a purchase
 * (`appAccountToken`). The server computes the same to check that a
 * purchase was made for this member (functions/src/entitlement.ts accountIdOf).
 */
export async function accountIdOf(uid: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** A base plan as the billing plugin reports it (@capgo/native-purchases Product). */
export interface StoreOffer {
  /** The base plan id. */
  identifier: string;
  /** The Play product id. */
  planIdentifier?: string;
  offerToken?: string;
  offerId?: string | null;
  price: number;
  priceString: string;
  currencyCode: string;
  introductoryPrice: {
    price: number;
    numberOfPeriods: number;
    subscriptionPeriod: { numberOfUnits: number; unit: number };
  } | null;
}

/** One plan and period as Play offers it to this person. */
export interface Offer {
  plan: PlanId;
  cycle: Cycle;
  basePlanId: string;
  /** The offer to buy: the free month when Play still offers it to this person. */
  offerToken?: string;
  /** The base plan without the free month, for changing an existing subscription. */
  baseOfferToken?: string;
  price: number;
  priceString: string;
  currencyCode: string;
  /** Free days this buyer can still get; 0 when Play offers none. */
  trialDays: number;
}

const DAYS_PER_UNIT = [1, 7, 30, 365];

/** Free days in an offer's first phase; 0 if it isn't free. */
export function trialDaysOf(o: StoreOffer): number {
  const intro = o.introductoryPrice;
  if (!intro || intro.price !== 0) return 0;
  const { numberOfUnits, unit } = intro.subscriptionPeriod;
  return numberOfUnits * (DAYS_PER_UNIT[unit] ?? 0) * Math.max(1, intro.numberOfPeriods || 1);
}

/**
 * One offer per plan and period. Play lists the free-month offer only to
 * people who can still have it, so it wins when present.
 */
export function offersOf(store: StoreOffer[]): Offer[] {
  const out: Offer[] = [];
  for (const o of store) {
    const pp = planOfBasePlan(o.identifier);
    if (!pp || (o.planIdentifier !== undefined && o.planIdentifier !== PLAY_PRODUCTS[pp.plan])) continue;
    const trialDays = trialDaysOf(o);
    const isBase = !o.offerId || trialDays === 0;
    const have = out.find(x => x.plan === pp.plan && x.cycle === pp.cycle);
    if (!have) {
      out.push({
        ...pp, basePlanId: o.identifier, price: o.price, priceString: o.priceString, currencyCode: o.currencyCode,
        offerToken: o.offerToken, baseOfferToken: isBase ? o.offerToken : undefined, trialDays,
      });
      continue;
    }
    if (trialDays > have.trialDays && (o.offerId === FREE_MONTH_OFFER || o.offerId)) {
      have.offerToken = o.offerToken;
      have.trialDays = trialDays;
    }
    if (isBase && !have.baseOfferToken) {
      have.baseOfferToken = o.offerToken;
      have.price = o.price;
      have.priceString = o.priceString;
    }
  }
  const order = (x: Offer) => (x.plan === 'essential' ? 0 : 2) + (x.cycle === 'monthly' ? 0 : 1);
  return out.sort((a, b) => order(a) - order(b));
}

/** The plans and periods Play offers this person. */
export async function loadOffers(): Promise<Offer[]> {
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [PLAY_PRODUCTS.essential, PLAY_PRODUCTS.plus],
    productType: PURCHASE_TYPE.SUBS,
  });
  return offersOf(products as unknown as StoreOffer[]);
}

export type BuyResult =
  | { kind: 'done'; entitlement: Entitlement }
  /** Closed Google's sheet. */
  | { kind: 'cancelled' }
  /** Play is waiting for the payment (some payment methods take time). */
  | { kind: 'pending' }
  /** Play took the purchase but the server couldn't check it yet; Restore purchases retries. */
  | { kind: 'unverified'; message: string }
  /** The subscription isn't on this phone's Google account: change it in Google Play. */
  | { kind: 'elsewhere' }
  /** Play didn't complete a purchase: nothing was charged. */
  | { kind: 'failed'; message: string };

const codeOf = (e: unknown): string => (typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '');
const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The server's word on a purchase token. */
const verify = (purchaseToken: string, productId: string): Promise<Entitlement> =>
  callFunction<Entitlement>('verifyPlayPurchase', { purchaseToken, productId });

/** This phone's current Play subscription to a plan, if any. */
async function currentPurchase(): Promise<{ token: string; product: string } | null> {
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS, onlyCurrentEntitlements: true });
  const ours = purchases.find(p => p.purchaseToken && (p.productIdentifier === PLAY_PRODUCTS.essential || p.productIdentifier === PLAY_PRODUCTS.plus));
  return ours?.purchaseToken ? { token: ours.purchaseToken, product: ours.productIdentifier } : null;
}

const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Google's purchase sheet, then the server's check. With a Play plan
 * already, the subscription is replaced in place: Plus now with the
 * difference charged, yearly now, or a move down at the next renewal.
 */
export async function buy(offer: Offer, uid: string, current: Entitlement | null): Promise<BuyResult> {
  const product = PLAY_PRODUCTS[offer.plan];
  const changing = current?.plan && current.source === 'play' && current.cycle;
  let replace: { oldPurchaseToken: string; oldProductIdentifier: string; replacementMode: NonNullable<ReturnType<typeof changeOf>['replacement']> } | null = null;
  if (changing) {
    const change = changeOf({ plan: current.plan!, cycle: current.cycle!, memberSince: current.memberSince }, offer, today());
    if (!change.replacement) return { kind: 'failed', message: 'That change isn\'t open yet.' };
    const old = await currentPurchase().catch(() => null);
    if (!old) return { kind: 'elsewhere' };
    replace = { oldPurchaseToken: old.token, oldProductIdentifier: old.product, replacementMode: change.replacement };
  }
  let token: string | undefined;
  let bought = product;
  holdLock();
  try {
    const transaction = await NativePurchases.purchaseProduct({
      productIdentifier: product,
      planIdentifier: offer.basePlanId,
      // A change never gets the free month: it's for new members.
      offerToken: replace ? offer.baseOfferToken : offer.offerToken,
      productType: PURCHASE_TYPE.SUBS,
      appAccountToken: await accountIdOf(uid),
      // The server acknowledges once it has checked the purchase.
      autoAcknowledgePurchases: false,
      ...(replace ?? {}),
    });
    token = transaction.purchaseToken;
    bought = transaction.productIdentifier || product;
  } catch (e) {
    const code = codeOf(e);
    if (code === 'USER_CANCELED') return { kind: 'cancelled' };
    if (code === 'ITEM_ALREADY_OWNED') {
      const restored = await restore();
      return restored ? { kind: 'done', entitlement: restored } : { kind: 'failed', message: messageOf(e) };
    }
    if (/pending/i.test(messageOf(e))) return { kind: 'pending' };
    log.warn('Plan purchase failed', e);
    return { kind: 'failed', message: messageOf(e) };
  } finally {
    releaseLock();
  }
  if (!token) return { kind: 'failed', message: 'Google Play returned no purchase.' };
  try {
    return { kind: 'done', entitlement: await verify(token, bought) };
  } catch (e) {
    // Bought but not yet checked: Restore purchases (or the next start) checks
    // it again. Play refunds it if it's still unacknowledged after 3 days.
    log.warn('Plan purchase not verified yet', e);
    return { kind: 'unverified', message: messageOf(e) };
  }
}

/**
 * Sends this phone's current Play subscriptions to the server. Returns the
 * best plan found, or null when there's none.
 */
export async function restore(): Promise<Entitlement | null> {
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS, onlyCurrentEntitlements: true });
  let best: Entitlement | null = null;
  for (const p of purchases) {
    if (!p.purchaseToken || (p.productIdentifier !== PLAY_PRODUCTS.essential && p.productIdentifier !== PLAY_PRODUCTS.plus)) continue;
    try {
      const e = await verify(p.purchaseToken, p.productIdentifier);
      if (!best || (e.plan === 'plus' && best.plan !== 'plus') || (e.plan && !best.plan)) best = e;
    } catch (e) {
      log.warn('A Play purchase could not be checked', e);
    }
  }
  return best;
}

/** Asks the server to read the subscription from Play again (its end date has passed). */
export const refresh = (): Promise<Entitlement | null> => callFunction<Entitlement | null>('refreshPlan');

/** Google Play's page for cancelling or changing the subscription. */
export async function manageSubscription(): Promise<void> {
  skipLockOnce();
  try {
    await NativePurchases.manageSubscriptions();
  } catch (e) {
    log.warn('Could not open Google Play subscriptions', e);
  }
}
