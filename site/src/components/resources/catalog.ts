export type Resource = {
  slug: string;
  title: string;
  description: string;
  group: string;
  bank?: {
    name: string;
    url: string;
    steps: string[];
  };
};

const calculators = [
  ["left-to-spend", "Left-to-spend calculator", "Subtract spending, upcoming bills and planned savings from money received."],
  ["50-30-20", "50/30/20 budget planner", "Split monthly take-home pay into needs, wants and savings."],
  ["emergency-fund", "Emergency fund calculator", "Estimate a cash buffer using essential monthly expenses and months of cover."],
  ["subscriptions", "Subscription yearly cost checker", "Add monthly or annual subscriptions and see their combined yearly cost."],
  ["savings-goal", "Savings goal planner", "Work out a monthly contribution toward a target, without assuming investment returns."],
  ["emi", "EMI calculator", "Estimate a fixed-rate loan instalment, total repayment and interest."],
  ["salary-in-hand", "Salary in-hand estimator", "Compare simplified old and new regime salary estimates for FY 2026–27."],
] as const;

const banks = [
  {
    slug: "idfc-first",
    name: "IDFC FIRST",
    url: "https://www.idfcfirstbank.com/",
    steps: [
      "Open the official IDFC FIRST Bank app or type the bank’s website address yourself and enter Internet Banking.",
      "Select the relevant savings or current account. Look for Account statement, Statements or a download option in account details.",
      "Choose your date range. Request or download the statement using the formats currently offered.",
    ],
  },
  {
    slug: "hdfc",
    name: "HDFC",
    url: "https://www.hdfcbank.com/",
    steps: [
      "Use HDFC Bank’s official app or open NetBanking through the official website.",
      "Select Accounts and the account you need. Look for Statement, Enquire or Account statement.",
      "Choose a period or a custom date range, then download or request the available statement format.",
    ],
  },
  {
    slug: "sbi",
    name: "SBI",
    url: "https://sbi.bank.in/",
    steps: [
      "Open SBI’s official website and follow its Personal Internet Banking link, or use the official YONO app.",
      "In Internet Banking, look under My Accounts & Profile for Account Statement. In the app, open the account’s statement options.",
      "Select your account and date range. Use the available download option rather than printing a screenshot.",
    ],
  },
  {
    slug: "kotak-mahindra",
    name: "Kotak Mahindra",
    url: "https://www.kotak.com/",
    steps: [
      "Open the official Kotak mobile banking app or Net Banking through the bank website.",
      "Select your bank account and look for Statement, Account Statement or Service Requests.",
      "Choose the statement period and use the available download or registered-email delivery option.",
    ],
  },
  {
    slug: "union-bank-of-india",
    name: "Union Bank of India",
    url: "https://www.unionbankofindia.bank.in/",
    steps: [
      "Open Union Bank of India’s official website and follow its Internet Banking link, or use the official mobile banking app.",
      "Choose your account, then look for Account Statement, Transaction History or an account-services statement request.",
      "Select your period and request or download the statement in an available format.",
    ],
  },
  {
    slug: "saraswat-bank",
    name: "Saraswat Bank",
    url: "https://www.saraswatbank.com/",
    steps: [
      "Start at Saraswat Bank’s official website and follow its Internet Banking link, or use its official mobile banking app.",
      "Select the account and look for Account Statement, Statements or account transaction enquiries.",
      "Choose the date range and use the available download or statement-request option. If unavailable, contact the bank through its official website.",
    ],
  },
];

export const resources: Resource[] = [
  ...calculators.map(([slug, title, description]) => ({
    slug, title, description, group: "Calculators",
  })),
  ...banks.map((bank) => ({
    slug: `${bank.slug}-statement`,
    title: `${bank.name} statement download guide`,
    description: `How to find and download your ${bank.name} account statement safely, with practical checks before you use it.`,
    group: "Bank statement guides",
    bank,
  })),
  {
    slug: "payment-codes",
    title: "UPI, NEFT & IMPS code glossary",
    description: "Understand common Indian payment rails, transaction references and bank statement abbreviations.",
    group: "Reference & templates",
  },
  {
    slug: "finance-glossary",
    title: "A–Z personal finance glossary",
    description: "Plain-English definitions of everyday personal finance terms, from APR to zero-based budgeting.",
    group: "Reference & templates",
  },
  {
    slug: "monthly-budget-sheet",
    title: "Monthly budget sheet",
    description: "Download a free CSV budget template directly from your browser. No email or sign-in required.",
    group: "Reference & templates",
  },
];

export const paymentTerms = [
  ["UPI", "Unified Payments Interface: an instant payment system. A UPI ID is a payment address, not proof of the recipient’s legal identity."],
  ["NEFT", "National Electronic Funds Transfer: bank-to-bank transfers processed in batches, available around the clock."],
  ["IMPS", "Immediate Payment Service: an instant interbank transfer service. Limits and charges depend on your bank and channel."],
  ["RTGS", "Real Time Gross Settlement: individual real-time settlement, generally for transfers of at least ₹2 lakh."],
  ["UTR", "Unique Transaction Reference: a bank-generated reference used to trace a transfer. Labels and formats vary by payment rail."],
  ["RRN", "Retrieval Reference Number: a transaction reference often shown for UPI or card payments. Keep it when reporting a problem."],
  ["IFSC", "Indian Financial System Code: an 11-character code identifying a bank branch for supported transfers."],
  ["VPA", "Virtual Payment Address: another name for a UPI ID, such as name@provider."],
  ["DR / DB", "Debit: money leaving this account. It can be a purchase, fee, cash withdrawal or transfer—not necessarily spending."],
  ["CR", "Credit: money entering this account. It can be income, a refund, borrowing or a transfer—not necessarily earnings."],
  ["REV / REVERSAL", "A reversal entry. Check the linked original transaction and final balance; wording alone does not establish a completed refund."],
  ["NACH / ECS", "Systems used for recurring debits or credits, including instalments and mandates."],
  ["POS", "Point of sale: usually a merchant card transaction."],
  ["ATM", "An ATM-related transaction, such as a cash withdrawal or associated fee."],
];

export const financeTerms = [
  ["APR", "Annual percentage rate: an annualised borrowing-cost measure. Check which fees the lender includes."],
  ["Budget", "A plan for assigning income to spending, saving and other commitments."],
  ["Compound interest", "Interest calculated on principal plus accumulated interest."],
  ["Debt", "Money owed to another person or organisation."],
  ["Emergency fund", "Accessible money set aside for unexpected essential costs or interrupted income."],
  ["Fixed expense", "An expense that is reasonably predictable each billing period."],
  ["Gross salary", "Pay before employee deductions and tax; it is not necessarily the same as CTC."],
  ["HRA", "House Rent Allowance: a salary component whose tax treatment depends on eligibility and the tax regime."],
  ["Inflation", "A rise in the general price level that reduces money’s purchasing power."],
  ["Joint account", "A bank account held by more than one person, subject to its operating mandate."],
  ["KYC", "Know Your Customer: identity-verification requirements used by regulated financial institutions."],
  ["Liquidity", "How readily an asset can be converted to usable cash without a substantial loss."],
  ["Minimum due", "The minimum card payment requested for a billing cycle. Paying only this can leave interest-bearing debt."],
  ["Net worth", "The value of assets minus liabilities."],
  ["Overdraft", "A facility allowing withdrawals beyond the account’s available balance, within agreed limits."],
  ["Principal", "The original amount borrowed or invested, excluding interest."],
  ["Quarter", "A three-month reporting period."],
  ["Recurring deposit", "A bank deposit funded through regular instalments over an agreed term."],
  ["Sinking fund", "Money built up gradually for a known future expense."],
  ["Take-home pay", "Salary remaining after payroll deductions and tax withholding."],
  ["Unsecured loan", "A loan not backed by a specific pledged asset; repayment obligations still apply."],
  ["Variable expense", "An expense whose amount changes between periods."],
  ["Withholding", "Tax deducted before income is paid, such as salary TDS. It may differ from final tax liability."],
  ["XIRR", "An annualised return calculation that accounts for cash flows on irregular dates."],
  ["Yield", "Income from an investment expressed relative to its price or value; definitions vary by product."],
  ["Zero-based budget", "A budget assigning every unit of income a purpose, including savings, rather than requiring a zero bank balance."],
];
