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
  CATEGORY_SPLIT = 'CATEGORY_SPLIT',
  IGNORE_RULES = 'IGNORE_RULES',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  SELF = 'SELF' // Profile
}

// Shared category list used across NewEntry, ImportStatement, and TransactionHistory
export const CATEGORIES = [
  'Groceries', 'Dining', 'Food Delivery', 'Coffee',
  'Transport', 'Fuel', 'Parking', 'Taxi', 'Metro', 'Flights',
  'Shopping', 'Electronics', 'Clothing', 'Furniture',
  'Entertainment', 'Movies', 'Streaming', 'Games',
  'Utilities', 'Electricity', 'Water', 'Gas', 'Internet', 'Phone',
  'Healthcare', 'Pharmacy', 'Doctor', 'Insurance',
  'Education', 'Books', 'Courses',
  'Bills', 'Rent', 'EMI', 'Loan', 'Credit Card',
  'Salary', 'Freelance', 'Bonus', 'Investment', 'Dividend', 'Interest',
  'Transfer', 'Cash', 'ATM',
  'Subscriptions', 'Gym', 'Charity',
  'Travel', 'Hotel', 'Vacation',
  'Personal Care', 'Beauty',
  'Pets', 'Gifts',
  'Other', 'Uncategorized',
] as const;

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  rate: number; // Rate relative to base (INR)
  locale: string;
}