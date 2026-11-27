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
  it("charges the full yearly price on a cycle change up and adds the unused time", () => { expect(RULES2.cycleUpChargesFullPriceAddsUnusedTime).toBe(true); });
  it("names the developer as operator, backed by SERNET, and the support email", () => {
    expect(CO.legalName).toBe("Akshat Vora");
    expect(CO.endorsement).toBe("Backed by SERNET");
    expect(CO.supportEmail).toBe("akshatbvora@gmail.com");
    expect(CO.grievanceOfficer).toBe("Akshat Vora");
  });
});

import { PLAN_TERMS_AT_A_GLANCE, PLAN_RULES as RULES3, SUBSCRIPTION_TERMS } from "./plans";
describe("plan terms shown before choosing", () => {
  it("covers trial, payment details, first charge, renewal, plan and cycle changes, moving down and records", () => {
    expect(PLAN_TERMS_AT_A_GLANCE.map(t => t.term)).toEqual([
      "Trial", "Payment details", "First charge", "Renewal and cancelling", "Essential and Plus", "Monthly and yearly", "After moving down", "Your records",
    ]);
  });
  it("moves down at the next renewal and never deletes records when a plan ends", () => {
    expect(RULES3.moveDownAtRenewal).toBe(true);
    expect(RULES3.recordsKeptAfterPlanEnds).toBe(true);
    expect(SUBSCRIPTION_TERMS.records).toMatch(/deleted only when you delete them yourself/);
  });
  it("says what each direction of a billing change does", () => {
    expect(SUBSCRIPTION_TERMS.cycleSwitch).toMatch(/Monthly to yearly starts straight away/);
    expect(SUBSCRIPTION_TERMS.cycleSwitch).toMatch(/Yearly to monthly starts when your paid year ends/);
    expect(SUBSCRIPTION_TERMS.cycleSwitch).toMatch(/full yearly price that day/);
  });
});
