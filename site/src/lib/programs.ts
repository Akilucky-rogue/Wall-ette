import type { PlanId } from "./plans";

export const REFERRAL_REWARD = {
  freeMonths: 1,
  rewardPlan: "each person’s current Essential or Plus plan",
  qualifiesAfter: "the referred friend’s first paid month",
  stacksWithNewMemberTrial: false,
} as const;

export const STUDENT_OFFER = {
  plan: "Essential",
  accessEnds: "on the verified course end date",
  verificationIntervalMonths: 12,
  minimumAge: 18,
  requiresPaymentMethodDuringApprovedPeriod: false,
  renewalRequiresVerification: true,
} as const;

export const GIFT_DISCOUNTS = [
  { minimum: 1, maximum: 4, rate: 0.05, label: "5%" },
  { minimum: 5, maximum: 19, rate: 0.1, label: "10%" },
  { minimum: 20, maximum: null, rate: 0.15, label: "15%" },
] as const;

export const GIFT_PLAN_PRICES: Record<PlanId, number> = {
  essential: 449,
  plus: 899,
};

export function giftDiscountRate(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Gift quantity must be at least one");
  if (quantity >= 20) return 0.15;
  if (quantity >= 5) return 0.1;
  return 0.05;
}

export function giftQuote(plan: PlanId, quantity: number) {
  const annualPrice = GIFT_PLAN_PRICES[plan];
  const subtotal = annualPrice * quantity;
  const rate = giftDiscountRate(quantity);
  const discount = Math.round(subtotal * rate);
  return { annualPrice, quantity, subtotal, rate, discount, total: subtotal - discount };
}
