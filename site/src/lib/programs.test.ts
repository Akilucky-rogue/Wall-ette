import { describe, expect, it } from "vitest";
import { giftQuote, REFERRAL_REWARD, STUDENT_OFFER } from "./programs";

describe("Spread programme rules", () => {
  it("rewards each person’s current plan only after the friend’s first paid month", () => {
    expect(REFERRAL_REWARD.freeMonths).toBe(1);
    expect(REFERRAL_REWARD.rewardPlan).toBe("each person’s current Essential or Plus plan");
    expect(REFERRAL_REWARD.qualifiesAfter).toBe("the referred friend’s first paid month");
    expect(REFERRAL_REWARD.stacksWithNewMemberTrial).toBe(false);
  });

  it("covers a verified adult’s course with annual checks and no card during approved access", () => {
    expect(STUDENT_OFFER.accessEnds).toBe("on the verified course end date");
    expect(STUDENT_OFFER.verificationIntervalMonths).toBe(12);
    expect(STUDENT_OFFER.minimumAge).toBe(18);
    expect(STUDENT_OFFER.requiresPaymentMethodDuringApprovedPeriod).toBe(false);
    expect(STUDENT_OFFER.renewalRequiresVerification).toBe(true);
  });

  it("prices one annual Essential gift with the published 5% discount", () => {
    expect(giftQuote("essential", 1)).toMatchObject({ subtotal: 449, discount: 22, total: 427, rate: 0.05 });
  });

  it("prices five annual Plus gifts with the published 10% discount", () => {
    expect(giftQuote("plus", 5)).toMatchObject({ subtotal: 4495, discount: 450, total: 4045, rate: 0.1 });
  });

  it("prices twenty annual Essential gifts with the published 15% discount", () => {
    expect(giftQuote("essential", 20)).toMatchObject({ subtotal: 8980, discount: 1347, total: 7633, rate: 0.15 });
  });
});
