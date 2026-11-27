import { describe, expect, it } from "vitest";
import { comparisonSelection } from "./compare-model";

describe("three-app comparison", () => {
  const peers = ["fold", "ynab", "lunch-money"];
  it("keeps exactly two selected peers beside Wall·ette", () => {
    expect(comparisonSelection(peers, "ynab", "lunch-money")).toEqual(["ynab", "lunch-money"]);
  });
  it("does not compare the same peer twice", () => {
    expect(comparisonSelection(peers, "ynab", "ynab")).toEqual(["ynab", "fold"]);
  });
  it("rejects unknown peer identifiers", () => {
    expect(comparisonSelection(peers, "invented", "unknown")).toEqual(["fold", "ynab"]);
  });
});