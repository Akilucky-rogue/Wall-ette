export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE'
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO string
  note?: string;
  merchant?: string;
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

export interface IgnoreRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  icon: string;
  color: string;
}

export interface UserProfile {
  email: string;
  lastLogin?: any; // Firestore Timestamp
  platform?: string;
}

export enum AppScreen {
  LOCK = 'LOCK',
  DASHBOARD = 'DASHBOARD',
  HISTORY = 'HISTORY', // Vault
  NEW_ENTRY = 'NEW_ENTRY',
  ANALYSIS = 'ANALYSIS', // Pulse
  INCOME_INSIGHTS = 'INCOME_INSIGHTS', // Flow
  CATEGORY_SPLIT = 'CATEGORY_SPLIT',
  IGNORE_RULES = 'IGNORE_RULES',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  HUNTER = 'HUNTER', // Fee & Subscription Hunter
  REWIND = 'REWIND', // Time Machine + Wrapped
  SELF = 'SELF' // Profile
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
  'Subscriptions', 'Gym', 'Charity',
  'Travel', 'Hotel', 'Vacation',
  'Personal Care', 'Beauty',
  'Pets', 'Gifts',
  'Salary', 'Freelance', 'Bonus', 'Interest Income', 'Dividend',
  'Investment Returns', 'Rental Income', 'Refunds',
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

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  rate: number; // Rate relative to base (INR)
  locale: string;
}