/**
 * Currency conversion - pure domain logic
 * Uses static rate table for now (can be replaced with API later)
 */

import { toCents, fromCents, multiplyCents, divideCents } from './money';

export type Currency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD' | 'AUD';

// Static exchange rates (base: USD)
// In production, these would come from an API
const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1.0,
  INR: 83.0, // Approximate
  EUR: 0.92, // Approximate
  GBP: 0.79, // Approximate
  CAD: 1.35, // Approximate
  AUD: 1.52, // Approximate
};

export interface CurrencyConversion {
  fromCurrency: Currency;
  toCurrency: Currency;
  amount: number;
  convertedAmount: number;
  rate: number;
  timestamp: Date;
}

/**
 * Get exchange rate between two currencies
 */
export function getExchangeRate(fromCurrency: Currency, toCurrency: Currency): number {
  if (fromCurrency === toCurrency) {
    return 1.0;
  }
  return EXCHANGE_RATES[toCurrency] / EXCHANGE_RATES[fromCurrency];
}

/**
 * Convert amount from one currency to another (pure function using cents internally)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): CurrencyConversion {
  if (fromCurrency === toCurrency) {
    return {
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount: amount,
      rate: 1.0,
      timestamp: new Date(),
    };
  }

  // Convert to cents for precision
  const amountCents = toCents(amount);
  
  // Convert from source currency to USD first (in cents)
  const rateFrom = EXCHANGE_RATES[fromCurrency];
  const amountInUSDCents = divideCents(amountCents, rateFrom);
  
  // Then convert from USD to target currency (in cents)
  const rateTo = EXCHANGE_RATES[toCurrency];
  const convertedAmountCents = multiplyCents(amountInUSDCents, rateTo);
  
  // Convert back to decimal
  const convertedAmount = fromCents(convertedAmountCents);
  const rate = rateTo / rateFrom;

  return {
    fromCurrency,
    toCurrency,
    amount,
    convertedAmount,
    rate,
    timestamp: new Date(),
  };
}

/**
 * Normalize amount to target currency (alias for convertCurrency for clarity)
 */
export function normalizeAmount(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): CurrencyConversion {
  return convertCurrency(amount, fromCurrency, toCurrency);
}

/**
 * Validate currency code
 */
export function isValidCurrency(currency: string): currency is Currency {
  return Object.keys(EXCHANGE_RATES).includes(currency);
}
