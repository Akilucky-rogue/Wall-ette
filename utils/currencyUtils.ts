import { CurrencyCode } from '../types';

/**
 * Currencies. Amounts are stored in INR (the base); the app shows them in any
 * currency the exchange-rate service knows (about 160), converted at live
 * rates (context/WalletContext.tsx). Names, symbols and decimal places come
 * from the browser's Intl data, so a new currency needs no code here.
 */

/** Rates (per 1 INR) built in for a first start offline; live rates replace them. */
export const FALLBACK_RATES: Record<string, number> = {
  INR: 1,
  USD: 0.0108,
  EUR: 0.00984,
  GBP: 0.00824,
};

/** Shown first in the picker, in this order. */
export const POPULAR_CURRENCIES: CurrencyCode[] = [
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'CHF', 'SAR', 'QAR', 'HKD', 'NZD', 'MYR', 'THB', 'ZAR', 'CNY',
];

/** Units of account in the rate feed that nobody spends. */
const NOT_SPENDABLE = new Set(['XDR', 'CLF']);

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && /^[A-Z]{3}$/.test(value);

/** INR in Indian grouping (₹1,23,456.00); every other currency in English grouping. */
export const localeFor = (code: CurrencyCode): string => (code === 'INR' ? 'en-IN' : 'en-US');

let displayNames: Intl.DisplayNames | null | undefined;
/** "Indian Rupee", "UAE Dirham"; the code when the browser doesn't know it. */
export function currencyName(code: CurrencyCode): string {
  if (displayNames === undefined) {
    try { displayNames = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch { displayNames = null; }
  }
  try { return displayNames?.of(code) ?? code; } catch { return code; }
}

const symbolCache = new Map<CurrencyCode, string>();
/** The short symbol: ₹, $, €, AED. */
export function getSymbol(code: CurrencyCode): string {
  let symbol = symbolCache.get(code);
  if (!symbol) {
    try {
      symbol = new Intl.NumberFormat(localeFor(code), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0).find(p => p.type === 'currency')?.value ?? code;
    } catch {
      symbol = code;
    }
    symbolCache.set(code, symbol);
  }
  return symbol;
}

/** Decimal places the currency uses (2 for INR, 0 for JPY, 3 for KWD). */
export function minorDigits(code: CurrencyCode): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

// Intl.NumberFormat construction is expensive; cache one formatter per
// currency and style (audit Phase 2.2). Formatters are stateless.
const cache = new Map<string, Intl.NumberFormat>();
function formatter(code: CurrencyCode, style: 'full' | 'whole' | 'compact'): Intl.NumberFormat {
  const key = `${code}:${style}`;
  let f = cache.get(key);
  if (!f) {
    const locale = localeFor(code);
    const options: Intl.NumberFormatOptions = { style: 'currency', currency: code };
    if (style === 'whole') { options.minimumFractionDigits = 0; options.maximumFractionDigits = 0; }
    if (style === 'compact') { options.notation = 'compact'; options.maximumFractionDigits = 1; }
    try {
      f = new Intl.NumberFormat(locale, options);
    } catch {
      f = new Intl.NumberFormat(locale, { ...options, currency: 'INR' });
    }
    cache.set(key, f);
  }
  return f;
}

/** ₹1,23,456.78, $1,234.56, ¥1,235: the currency's own decimal places. */
export const getCurrencyFormatter = (code: CurrencyCode): Intl.NumberFormat => formatter(code, 'full');
/** ₹1,23,457: no decimals, for figures read at a glance. */
export const getWholeCurrencyFormatter = (code: CurrencyCode): Intl.NumberFormat => formatter(code, 'whole');
/** ₹85.7K, ₹1.2L, $4.5K: chart axes and tight spaces. */
export const getCompactCurrencyFormatter = (code: CurrencyCode): Intl.NumberFormat => formatter(code, 'compact');

/** The currencies the picker offers: those with a rate, popular first, then by name. */
export function currencyChoices(rates: Record<string, number>): CurrencyCode[] {
  const codes = Object.keys(rates).filter(c => isCurrencyCode(c) && !NOT_SPENDABLE.has(c) && rates[c] > 0);
  const popular = POPULAR_CURRENCIES.filter(c => codes.includes(c));
  const rest = codes.filter(c => !POPULAR_CURRENCIES.includes(c)).sort((a, b) => currencyName(a).localeCompare(currencyName(b)));
  return [...popular, ...rest];
}

/**
 * Round a converted amount to a figure people type: 1.2 → 1, 23 → 25,
 * 180 → 200, 4,310 → 4,500. For quick-amount chips in another currency.
 */
export function niceAmount(n: number): number {
  if (n <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const m = n / p;
  const step = steps.reduce((best, s) => (Math.abs(s - m) < Math.abs(best - m) ? s : best), steps[0]);
  return Math.round(step * p * 100) / 100;
}

/**
 * Money people type (a budget, a limit, an entry) is in the currency shown;
 * it is saved in rupees. `toBase` turns a typed amount into rupees to the
 * paisa; `toShown` turns saved rupees back into the shown currency for an
 * input, to two decimals. With INR shown both are exact no-ops.
 */
export const toBase = (shownAmount: number, rate: number): number =>
  rate > 0 && Number.isFinite(shownAmount) ? Math.round((shownAmount / rate) * 100) / 100 : 0;
export const toShown = (baseAmount: number, rate: number, digits = 2): number => {
  if (!Number.isFinite(baseAmount)) return 0;
  const f = 10 ** digits;
  return Math.round(baseAmount * rate * f) / f;
};

/**
 * Decimal places for a saved amount shown in an input: the currency's own,
 * but none finer than one paisa is worth in it. A rupee is under two yen, so
 * yen (and won, rupiah, dong) read back in whole units instead of
 * ¥1,500.01.
 */
export function inputDigits(code: CurrencyCode, rate: number): number {
  const own = minorDigits(code);
  if (!(rate > 1)) return own;
  return Math.max(0, Math.min(own, Math.floor(2 - Math.log10(rate) + 1e-9)));
}
