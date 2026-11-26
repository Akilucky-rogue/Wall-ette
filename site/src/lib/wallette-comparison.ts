import { PLANS } from "./plans";
import { inr } from "./money";
import { COMPANY } from "./site";
import type { ComparisonApp } from "./compare-model";

export const WALLETTE_COMPARISON: ComparisonApp = {
  id: "wallette",
  name: COMPANY.brand,
  kind: "Statement-first personal money tracking",
  origin: "India · built by Akshat Vora, backed by SERNET",
  countries: "Built for India and INR; not positioned as a global bank-sync service.",
  india: "IDFC FIRST, HDFC, SBI, Kotak, Union Bank and Saraswat statement formats. Support varies by PDF / Excel format.",
  tracking: "Import supported PDF / Excel statements, review transactions and categorisation. No Account Aggregator connection or SMS access claimed.",
  storage: "Statement extraction stays on-device; saved transactions sync to a private account. This is not local-only storage. Export and deletion on both plans.",
  platforms: "Web available; Android coming soon, iPhone planned. Future mobile features are not counted as available.",
  price: PLANS.map(plan => `${plan.name}: ${inr(plan.monthly)}/month or ${inr(plan.yearly)}/year`).join(". "),
  trial: "Free while paid plans are set up. Then the first 30 days are ₹0 for new memberships, with card / bank details required; no permanent free plan.",
  features: "Reviewed statement imports, transfer-aware spending, Vault / Pulse and Left to spend. Plus adds unlimited accounts, full history, Money flow / Rewind and recurring tracking.",
  fit: "Indian earners and households who want to review bank activity, distinguish transfers from expenses and understand what remains before payday.",
  caveat: "Requires statement imports rather than live bank automation. Not business accounting or investment advice. Upgrade anytime; downgrade after year one; restarts have no free month.",
  sources: [
    { label: "Features & supported banks", url: `${COMPANY.siteUrl}/features` },
    { label: "Plans & trial terms", url: `${COMPANY.siteUrl}/pricing` },
    { label: "Privacy & storage", url: `${COMPANY.siteUrl}/privacy` },
    { label: "Platform roadmap", url: `${COMPANY.siteUrl}/roadmap` },
  ],
};