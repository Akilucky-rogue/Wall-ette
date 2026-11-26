import { describe, expect, it } from "vitest";
import { COMPARISON_PEERS, PEER_IDS } from "./comparison-catalog";
import { comparisonSelection } from "./compare-model";

describe("requested comparison coverage", () => {
  it("includes every requested peer except the postponed Mfinley", () => {
    expect([...PEER_IDS].sort()).toEqual(["fold", "axio", "mojek", "realbyte", "cashew", "spendee", "money-lover", "lunch-money", "money-pro", "fast-budget", "ynab", "copilot", "monarch", "everydollar", "quickbooks", "actual-budget", "credit-karma", "empower", "mint", "rocket-money", "simplifi"].sort());
  });
  it("keeps Mint historical rather than presenting it as available", () => {
    expect(COMPARISON_PEERS.find(app => app.id === "mint")?.status).toBe("discontinued");
  });
  it("supports each peer in a distinct two-peer shortlist", () => {
    for (const id of PEER_IDS) {
      const pair = comparisonSelection(PEER_IDS, id, id);
      expect(pair[0]).toBe(id);
      expect(pair[1]).not.toBe(id);
      expect(PEER_IDS).toContain(pair[1]);
    }
  });
});