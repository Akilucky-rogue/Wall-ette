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
} as const;

/** One-line subscription terms reused by signup, pricing, FAQ and legal copy. */
export const SUBSCRIPTION_TERMS = {
  trial: "New members get 30 days at ₹0 on either plan. Card or UPI/bank payment details are required to start.",
  firstCharge: "The first charge is taken on day 31 at the full price of the plan and billing period you chose; cancel before then and you pay nothing.",
  renewal: "Plans renew automatically each month or year until you cancel. Cancelling stops the next renewal; you keep access until the paid period ends.",
  planSwitch: "Move up from Essential to Plus anytime. Moving down from Plus to Essential is available after your first year.",
  cycleSwitch: "Switching between monthly and yearly billing mid-term applies straight away, with the price difference charged.",
  afterDowngrade: "Nothing is deleted when you move down. Extra accounts and history beyond Essential's limits become read-only until you upgrade again.",
  dataAccess: "Export and deletion stay available on every plan, and after a plan ends.",
  records: "Your records are kept when a subscription ends or expires. They are deleted only when you delete them yourself or ask us to.",
  restart: "A restarted subscription counts from the restart day as month one; the free month is for new memberships only.",
} as const;

export const PLAN_CHANGE_FAQ = [
  { q: "Can I switch between Essential and Plus?", a: "You can upgrade from Essential to Plus at any time. Moving down from Plus to Essential is available after the first year of your subscription." },
  { q: "Can I switch between monthly and yearly billing?", a: SUBSCRIPTION_TERMS.cycleSwitch },
  { q: "What happens to my records after I move down or my plan ends?", a: `${SUBSCRIPTION_TERMS.afterDowngrade} ${SUBSCRIPTION_TERMS.records} ${SUBSCRIPTION_TERMS.dataAccess}` },
  { q: "What happens if I pause or stop and later restart?", a: "A restarted subscription counts from the day you restart, as your new month one. The free first month is only for new memberships, so a restart is charged from day one." },
];
