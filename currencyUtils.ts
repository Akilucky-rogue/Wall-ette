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
