export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  /** Local calendar day, 'YYYY-MM-DD'. Build and read it with utils/dates.ts. */
  date: string;
  note?: string;
  merchant?: string;
  /** When the entry was added in New Entry (ISO timestamp). Imported rows have none. */
  createdAt?: string;
  /**
   * The bank account an imported row came from (services/accounts.ts
   * accountKey: bank and last four digits). From 1.5.9; rows imported
   * earlier, and entries typed in, have none.
   */
  account?: string;
  /**
   * For an entry typed in another currency: the amount as typed and its code.
   * `amount` is the same in rupees, to the paisa; these let the entry read
   * back exactly as typed (¥1,500, not ¥1,500.01) while it's shown in that
   * currency.
   */
  typedAmount?: number;
  typedCurrency?: string;
  /**
   * Set on an entry Wall-ette added by itself (from 1.6.0): the payment app
   * whose notification it was read from (services/paymentAlerts.ts
   * PAYMENT_APPS id, e.g. 'gpay'), or 'share' for text shared to
   * Wall-ette. It stands in for the payment until a statement brings the
   * same one, whose row then takes its place (services/captured.ts).
   */
  via?: string;
}

export interface IncomeSource {
  id: string;
  name: string;
  type: string; // e.g., 'Fixed Monthly', 'Digital Rewards'
  amount: number;
  isActive: boolean;
  colorClass: string;
  icon: string;
}

/**
 * How payments to or from a payee count (Money Moved screen, audit H3).
 * mine, family, investment and ignore are money moved: in the balance, but
 * neither spending nor income. counts keeps a payee counted; salary also marks
 * its credits as your pay.
 */
export type PayeeKind = 'mine' | 'family' | 'investment' | 'ignore' | 'counts' | 'salary';

export interface PayeeRule {
  id: string;
  /** Words to look for in the payee, e.g. "ravi kumar". Matched as whole words. */
  match: string;
  kind: PayeeKind;
  /**
   * For a payee that counts: the category its payments show under instead of
   * the importer's "Transfer Out" (a landlord's as Rent, say). Set by the
   * review after an import; payments with a category of their own keep it.
   */
  category?: string;
}

export interface UserProfile {
  email: string;
  lastLogin?: any; // Firestore Timestamp
  platform?: string;
}

export enum AppScreen {
  LOCK = 'LOCK',
  DASHBOARD = 'DASHBOARD',
  LEFT_TO_SPEND = 'LEFT_TO_SPEND', // Home's "what's left until pay day"
  HISTORY = 'HISTORY', // Vault
  NEW_ENTRY = 'NEW_ENTRY',
  ANALYSIS = 'ANALYSIS', // Pulse
  PULSE_TRENDS = 'PULSE_TRENDS',
  PULSE_CATEGORIES = 'PULSE_CATEGORIES',
  PULSE_RECURRING = 'PULSE_RECURRING',
  PULSE_HEALTH = 'PULSE_HEALTH',
  INCOME_INSIGHTS = 'INCOME_INSIGHTS', // Flow
  CATEGORY_SPLIT = 'CATEGORY_SPLIT',
  MONEY_MOVED = 'MONEY_MOVED', // payee rules: what counts as spending
  BANK_ACCOUNTS = 'BANK_ACCOUNTS', // Self → Your data → Bank accounts
  PAYMENT_APPS = 'PAYMENT_APPS', // Self → Your data → Payments from your apps (Android)
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  REWIND = 'REWIND', // Time Machine + Wrapped
  SELF = 'SELF', // Profile
  SELF_ACCOUNT = 'SELF_ACCOUNT', // Account and security
  SELF_ALERTS = 'SELF_ALERTS', // Alerts and limits
  SELF_DATA = 'SELF_DATA', // Your data
  SELF_APPEARANCE = 'SELF_APPEARANCE',
  SELF_ABOUT = 'SELF_ABOUT',
  SELF_PLAN = 'SELF_PLAN', // Self → Your plan (once paid plans are on)
}

// The one category list: statement parsers (services/categorize.ts), New
// Entry, the Edit dialogs and budgets all use these names (audit M10).
export const CATEGORIES = [
  'Groceries', 'Dining', 'Food Delivery', 'Coffee',
  'Transport', 'Fuel', 'Parking', 'Taxi & Cab', 'Metro', 'Train', 'Flights',
  'Shopping', 'Online Shopping', 'Electronics', 'Clothing', 'Furniture',
  'Entertainment', 'Movies', 'Streaming', 'Music', 'Games',
  'Utilities', 'Electricity', 'Water', 'Gas', 'Phone & Internet',
  'Healthcare', 'Pharmacy', 'Doctor & Hospital', 'Insurance',
  'Education', 'Books', 'Courses',
  'Bills', 'Rent', 'Loan & EMI', 'Credit Card',
  'Subscriptions', 'Software', 'Gym', 'Charity',
  'Travel', 'Hotel', 'Vacation',
  'Personal Care', 'Beauty',
  'Pets', 'Gifts',
  'Salary', 'Freelance', 'Bonus', 'Interest Income', 'Dividend',
  'Investment Returns', 'Redemption proceeds', 'Rental Income', 'Refunds',
  'Investment', 'Transfer Out', 'Transfer In', 'Cash Withdrawal', 'Adjustment',
  'Other', 'Uncategorized',
] as const;

export type Category = typeof CATEGORIES[number];

// Names earlier versions offered in New Entry and Edit, mapped once to the
// list's name for the same thing.
const LEGACY_CATEGORIES: Record<string, Category> = {
  Taxi: 'Taxi & Cab',
  Phone: 'Phone & Internet',
  Internet: 'Phone & Internet',
  Doctor: 'Doctor & Hospital',
  EMI: 'Loan & EMI',
  Loan: 'Loan & EMI',
  Cash: 'Cash Withdrawal',
  ATM: 'Cash Withdrawal',
  Interest: 'Interest Income',
};

/** The list's name for a stored category; names it doesn't know pass through. */
export function canonicalCategory(category: string, type: TransactionType): string {
  if (category === 'Transfer') return type === TransactionType.INCOME ? 'Transfer In' : 'Transfer Out';
  if (category === 'Investment' && type === TransactionType.INCOME) return 'Investment Returns';
  return LEGACY_CATEGORIES[category] ?? category;
}

/** Edit dropdown options: the list, plus the current value if it isn't on it. */
export function categoryOptions(current: string): readonly string[] {
  return current && !(CATEGORIES as readonly string[]).includes(current) ? [current, ...CATEGORIES] : CATEGORIES;
}

/** An ISO 4217 code ('INR', 'USD', 'AED', …). Stored amounts are always INR. */
export type CurrencyCode = string;