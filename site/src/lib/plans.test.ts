import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";

describe("subscription pricing", () => {
  it("gives both plans a first month of 30 days at no charge, with payment details required", () => {
    expect(PLANS.map((plan) => plan.trialDays)).toEqual([30, 30]);
    expect(PLANS.every((plan) => plan.requiresPaymentMethod)).toBe(true);
  });
  it("keeps Essential at ₹49 monthly and Plus at ₹99 monthly", () => {
    expect(PLANS.map((plan) => plan.monthly)).toEqual([49, 99]);
  });
  it("keeps Essential at ₹449 yearly and Plus at ₹899 yearly", () => {
    expect(PLANS.map((plan) => plan.yearly)).toEqual([449, 899]);
  });
  it("uses the confirmed Essential and Plus names in order", () => {
    expect(PLANS.map((plan) => plan.name)).toEqual(["Essential", "Plus"]);
  });
});

import { PLAN_RULES } from "./plans";
describe("plan change rules", () => {
  it("allows upgrades anytime but downgrades only after 12 months", () => {
    expect(PLAN_RULES.upgradeAnytime).toBe(true);
    expect(PLAN_RULES.downgradeAfterMonths).toBe(12);
  });
  it("gives no free month on restart; restart counts as month one", () => {
    expect(PLAN_RULES.freeMonthForNewMembersOnly).toBe(true);
    expect(PLAN_RULES.restartCountsAsMonthOne).toBe(true);
  });
});

import { PLAN_RULES as RULES2 } from "./plans";
import { COMPANY as CO } from "./site";
describe("operator and billing rules", () => {
  it("charges first on day 31", () => { expect(RULES2.firstChargeDay).toBe(31); });
  it("charges the difference on mid-term cycle change", () => { expect(RULES2.midTermCycleChangeChargesDifference).toBe(true); });
  it("names the developer as operator, backed by SERNET, and the support email", () => {
    expect(CO.legalName).toBe("Akshat Vora");
    expect(CO.endorsement).toBe("Backed by SERNET");
    expect(CO.supportEmail).toBe("akshatbvora@gmail.com");
    expect(CO.grievanceOfficer).toBe("Akshat Vora");
  });
});
