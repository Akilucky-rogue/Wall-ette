import { describe, expect, it } from "vitest";
import { inr, leftToSpend } from "./money";

describe("money", () => {
  it("groups rupees the Indian way", () => {
    expect(inr(277023)).toBe("₹2,77,023");
  });
  it("shows signed income and spending", () => {
    expect(inr(85000, { sign: true })).toBe("+₹85,000");
    expect(inr(-24000, { sign: true })).toBe("−₹24,000");
  });
  it("computes left to spend like the site example", () => {
    expect(leftToSpend({ cameIn: 85000, spent: 50616, billsDue: 649, savingsGoal: 15000 })).toBe(18735);
  });
});
