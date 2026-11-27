import { Transaction, TransactionType } from '../types';
import { toBase } from './currencyUtils';

/**
 * New entry's keypad: the amount typed so far, as text, after one more key.
 * Pure, so scripts/check-entry.mjs can press every key.
 *
 *   '0'–'9', '.'   add to the amount (two decimals at most, one point,
 *                  eight digits before the point)
 *   'backspace'    take the last character off
 *
 * '0.00' is the empty amount.
 */
export const EMPTY_AMOUNT = '0.00';

export function pressKey(amount: string, key: string): string {
  if (key === 'backspace') {
    if (amount.length <= 1 || amount === EMPTY_AMOUNT) return EMPTY_AMOUNT;
    const next = amount.slice(0, -1);
    return next === '' || next === '0' ? EMPTY_AMOUNT : next;
  }
  if (!/^[0-9.]$/.test(key)) return amount;
  if (amount === EMPTY_AMOUNT) return key === '.' ? '0.' : key === '0' ? EMPTY_AMOUNT : key;
  if (key === '.' && amount.includes('.')) return amount;
  const dot = amount.indexOf('.');
  if (dot !== -1 && amount.length - dot > 2) return amount; // two decimals
  if (dot === -1 && amount.length >= 8 && key !== '.') return amount; // eight digits
  return amount + key;
}

/** The typed amount as a number (0 for the empty amount). */
export const amountValue = (amount: string): number => {
  const n = parseFloat(amount);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** What New entry's form holds when Save is pressed. */
export interface EntryForm {
  /** The keypad's text, in the currency shown. */
  typed: string;
  /** Rupees to the shown currency (1 for rupees). */
  rate: number;
  /** The currency shown ('INR', 'USD', …). */
  currency: string;
  type: TransactionType;
  category: string;
  merchant: string;
  note: string;
  /** The day picked, 'YYYY-MM-DD'. */
  day: string;
}

/**
 * The entry New entry saves, or null when there's no amount: rupees to the
 * paisa, the day picked, a payee even when none was typed, and when it was
 * added (which orders entries on the same day).
 */
export function entryFromForm(form: EntryForm, id: string, now: Date): Transaction | null {
  const amount = toBase(amountValue(form.typed), form.rate);
  if (!(amount > 0)) return null;
  const payee = form.merchant.trim()
    || (form.type === TransactionType.EXPENSE ? (form.note.trim() || 'Unknown Merchant') : 'Income Source');
  const entry: Transaction = {
    id,
    amount,
    type: form.type,
    category: form.category || 'Uncategorized',
    date: form.day,
    createdAt: now.toISOString(),
    note: form.note,
    merchant: payee,
  };
  // Typed in another currency: keep what was typed, so it reads back exactly.
  if (form.currency !== 'INR') {
    entry.typedAmount = amountValue(form.typed);
    entry.typedCurrency = form.currency;
  }
  return entry;
}
