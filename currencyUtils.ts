import { CurrencyCode, CurrencyConfig } from './types';

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', rate: 1, locale: 'en-IN' },
  USD: { code: 'USD', symbol: '$', rate: 0.012, locale: 'en-US' }, 
  EUR: { code: 'EUR', symbol: '€', rate: 0.011, locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', rate: 0.0095, locale: 'en-GB' },
};

export const getSymbol = (code: CurrencyCode): string => {
  return CURRENCIES[code].symbol;
}

export const getCurrencyConfig = (code: CurrencyCode): CurrencyConfig => {
    return CURRENCIES[code];
}

// Intl.NumberFormat construction is expensive; cache one formatter per currency
// (audit Phase 2.2). Formatters are stateless and safe to reuse.
const formatterCache = new Map<CurrencyCode, Intl.NumberFormat>();
const compactFormatterCache = new Map<CurrencyCode, Intl.NumberFormat>();

/** Compact axis-label formatter: ₹85.7K / ₹1.2L / $4.5K */
export const getCompactCurrencyFormatter = (code: CurrencyCode): Intl.NumberFormat => {
  let formatter = compactFormatterCache.get(code);
  if (!formatter) {
    const config = CURRENCIES[code];
    formatter = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: code,
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    compactFormatterCache.set(code, formatter);
  }
  return formatter;
};

export const getCurrencyFormatter = (code: CurrencyCode): Intl.NumberFormat => {
  let formatter = formatterCache.get(code);
  if (!formatter) {
    const config = CURRENCIES[code];
    formatter = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatterCache.set(code, formatter);
  }
  return formatter;
};
