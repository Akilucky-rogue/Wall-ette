/** Sub-category and hashtags for each article, keyed by slug. */
export const ARTICLE_META: Record<string, { sub: string; tags: readonly string[] }> = {
  "read-bank-statement": { sub: "Reading statements", tags: ["Bank Statement", "UPI", "NEFT", "Reconciliation"] },
  "salary-cash-flow": { sub: "Salary planning", tags: ["Salary", "Cash Flow", "Bills"] },
  "50-30-20-budget-india": { sub: "Budget methods", tags: ["Budget", "50-30-20", "Household"] },
  "family-transfers": { sub: "Transfers", tags: ["Family Support", "Transfers", "Reimbursements"] },
  "left-to-spend": { sub: "Salary planning", tags: ["Left to Spend", "Cash Flow", "Payday"] },
  "hidden-subscriptions": { sub: "Subscriptions", tags: ["Subscriptions", "Renewals", "Bills"] },
  "upi-spending": { sub: "UPI payments", tags: ["UPI", "Small Spends", "Tracking"] },
  "password-protected-statements": { sub: "File safety", tags: ["PDF Safety", "Privacy", "Bank Statement"] },
  "emergency-fund-salary": { sub: "Emergency fund", tags: ["Emergency Fund", "Savings", "Salary"] },
  "monthly-money-check-in": { sub: "Monthly review", tags: ["Monthly Review", "Routine", "Tracking"] },
};

export function metaFor(slug: string) {
  return ARTICLE_META[slug] ?? { sub: "Guides", tags: [] };
}
