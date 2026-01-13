/**
 * Currency conversion service - compatibility exports from domain module
 * @deprecated Use domain/currency directly
 */

// Re-export from domain module for backward compatibility
export {
  type Currency,
  type CurrencyConversion,
  convertCurrency,
  normalizeAmount,
  getExchangeRate,
  isValidCurrency,
} from '../domain/currency';
