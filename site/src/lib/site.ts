export const COMPANY = {
  brand: "Wall·ette",
  /** Who runs Wall·ette and answers for it: its developer, as an individual. */
  legalName: "Akshat Vora",
  operatorRelationship: "Wall·ette is built and run by Akshat Vora, an independent developer in Mumbai, and backed by SERNET.",
  endorsement: "Backed by SERNET",
  descriptor: "Money Tracking & Budgeting",
  founder: "Akshat",
  grievanceOfficer: "Akshat Vora",
  grievanceTitle: "Grievance Officer",
  supportEmail: "akshatbvora@gmail.com",
  dataAccessNote: "SERNET backs Wall·ette but has no access to your account or your financial records.",
  nonAdvisory: "Wall·ette helps you organise recorded transactions and manage your own budgets. It does not recommend investments or provide personalised investment advice.",
  privacyProcessing: "The original statement is processed on your device. Extracted transaction records are stored in your private account to support synchronisation.",
  address: "Mumbai, Maharashtra, India",
  addressLines: ["Mumbai, Maharashtra", "India"],
  siteUrl: "https://wall-ette.com",
  appUrl: "/app",
  tagline: "Your personal finance companion",
  promise: "Import your statement, check the numbers and understand your spending, transfers and commitments - all in one place.",
} as const;

export const FEATURE_SECTIONS = [
  { id: "import", title: "Import statements" },
  { id: "expenses", title: "Expense tracker" },
  { id: "flow", title: "Money flow" },
  { id: "left-to-spend", title: "Left to spend" },
] as const;

export const BANKS = [
  { name: "IDFC FIRST", key: "idfc", formats: ["PDF", "Excel"] },
  { name: "HDFC", key: "hdfc", formats: ["Excel"] },
  { name: "SBI", key: "sbi", formats: ["PDF"] },
  { name: "Kotak Mahindra", key: "kotak", formats: ["PDF"] },
  { name: "Union Bank of India", key: "union", formats: ["PDF"] },
  { name: "Saraswat Bank", key: "saraswat", formats: ["PDF"] },
] as const;
