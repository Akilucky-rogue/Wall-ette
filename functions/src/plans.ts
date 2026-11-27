/**
 * The plan constants the server needs: the same as services/planRules.ts in
 * the app (scripts/check-plans.mjs keeps the two equal) and wall-ette.com
 * (site/src/lib/plans.ts, programs.ts).
 */

export type PlanId = 'essential' | 'plus';
export type Cycle = 'monthly' | 'yearly';

/** One Google Play subscription per plan, with base plans `<plan>-monthly` and `<plan>-yearly`. */
export const PLAY_PRODUCTS = { essential: 'essential', plus: 'plus' } as const;
/** The 30-day ₹0 offer on every base plan, for people who never had a subscription. */
export const FREE_MONTH_OFFER = 'free-month';

export const REFERRAL_REWARD_MONTHS = 1;
/** A friend's code counts for this long after they join. */
export const REFERRAL_WINDOW_DAYS = 30;
/** The friend's first paid month must have run this long before both are rewarded. */
export const FIRST_PAID_MONTH_DAYS = 30;
export const GIFT_MONTHS = 12;
export const STUDENT_RECHECK_MONTHS = 12;

/** Letters and digits that can't be misread for each other (no 0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const isPlanId = (v: unknown): v is PlanId => v === 'essential' || v === 'plus';
export const isPlayProduct = (v: unknown): v is PlanId => v === PLAY_PRODUCTS.essential || v === PLAY_PRODUCTS.plus;

/** The plan and period of a Play base plan id; null for anything else. */
export function planOfBasePlan(id: string | null | undefined): { plan: PlanId; cycle: Cycle } | null {
  const m = /^(essential|plus)-(monthly|yearly)$/.exec(id ?? '');
  return m ? { plan: m[1] as PlanId, cycle: m[2] as Cycle } : null;
}

/** Whole calendar months later, keeping the day where the month has it (UTC). */
export function addMonths(at: Date, months: number): Date {
  const d = new Date(at.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
