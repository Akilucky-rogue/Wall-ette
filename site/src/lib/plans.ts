export const PLANS = [
  { id: "essential", name: "Essential", monthly: 49, yearly: 449, equivalent: 37, note: "Core tracking · 1 bank account", trialDays: 30, requiresPaymentMethod: true },
  { id: "plus", name: "Plus", monthly: 99, yearly: 899, equivalent: 75, note: "Unlimited accounts · full history", trialDays: 30, requiresPaymentMethod: true },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];
export type BillingCycle = "monthly" | "yearly";

/** Plan-change and restart rules shown across pricing, FAQ, legal and signup copy. */
export const PLAN_RULES = {
  upgradeAnytime: true,
  downgradeAfterMonths: 12,
  freeMonthForNewMembersOnly: true,
  restartCountsAsMonthOne: true,
  firstChargeDay: 31,
  midTermCycleChangeChargesDifference: true,
  /** Moving down (Plus → Essential, yearly → monthly) starts at the next renewal. */
  moveDownAtRenewal: true,
  /** A plan ending or moving down never deletes records; only the member does. */
  recordsKeptAfterPlanEnds: true,
} as const;

/** One-line subscription terms reused by signup, pricing, FAQ and legal copy. */
export const SUBSCRIPTION_TERMS = {
  trial: "New members get 30 days at ₹0 on either plan. Card or UPI/bank payment details are required to start.",
  firstCharge: "The first charge is taken on day 31 at the full price of the plan and billing period you chose; cancel before then and you pay nothing.",
  renewal: "Plans renew automatically each month or year until you cancel. Cancel any time before a renewal: it stops the next charge, you keep access until the paid period ends, and nothing is deleted.",
  planSwitch: "Move up from Essential to Plus at any time: Plus starts straight away, and you pay the price difference for the rest of your current period. Moving down from Plus to Essential is available after your first year and starts at your next renewal; you keep Plus until then.",
  cycleSwitch: "Monthly to yearly starts straight away: you pay the yearly price less the unused part of your month, and your year starts that day. Yearly to monthly starts when your paid year ends; until then you keep the year you paid for.",
  afterDowngrade: "Nothing is deleted when you move down. Extra accounts and history beyond Essential's limits become read-only until you upgrade again.",
  dataAccess: "Export and deletion stay available on every plan, and after a plan ends.",
  records: "Your records are kept when a subscription ends or expires. They are deleted only when you delete them yourself or ask us to.",
  restart: "A restarted subscription counts from the restart day as month one; the free month is for new memberships only.",
} as const;

/** Every rule a member needs before choosing, in the order they meet them (pricing page). */
export const PLAN_TERMS_AT_A_GLANCE: readonly { term: string; text: string }[] = [
  { term: "Trial", text: "30 days at ₹0 on either plan, for new members." },
  { term: "Payment details", text: "Card or UPI/bank payment details are needed to start the trial. Nothing is charged during it." },
  { term: "First charge", text: "Day 31, at the full price of the plan and billing period you chose: Essential ₹49 a month or ₹449 a year, Plus ₹99 a month or ₹899 a year. Cancel before then and you pay nothing." },
  { term: "Renewal and cancelling", text: SUBSCRIPTION_TERMS.renewal },
  { term: "Essential and Plus", text: SUBSCRIPTION_TERMS.planSwitch },
  { term: "Monthly and yearly", text: SUBSCRIPTION_TERMS.cycleSwitch },
  { term: "After moving down", text: SUBSCRIPTION_TERMS.afterDowngrade },
  { term: "Your records", text: `${SUBSCRIPTION_TERMS.records} ${SUBSCRIPTION_TERMS.dataAccess}` },
];

export const PLAN_CHANGE_FAQ = [
  { q: "Can I switch between Essential and Plus?", a: SUBSCRIPTION_TERMS.planSwitch },
  { q: "How do renewal and cancelling work?", a: SUBSCRIPTION_TERMS.renewal },
  { q: "Can I switch between monthly and yearly billing?", a: SUBSCRIPTION_TERMS.cycleSwitch },
  { q: "What happens to my records after I move down or my plan ends?", a: `${SUBSCRIPTION_TERMS.afterDowngrade} ${SUBSCRIPTION_TERMS.records} ${SUBSCRIPTION_TERMS.dataAccess}` },
  { q: "What happens if I pause or stop and later restart?", a: "A restarted subscription counts from the day you restart, as your new month one. The free first month is only for new memberships, so a restart is charged from day one." },
];
