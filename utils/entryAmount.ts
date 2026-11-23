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
