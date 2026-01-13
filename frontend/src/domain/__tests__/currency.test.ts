import { describe, it, expect } from 'vitest';
import { convertCurrency, normalizeAmount, getExchangeRate, isValidCurrency } from '../currency';

describe('currency conversion', () => {
  describe('convertCurrency', () => {
    it('returns same amount for same currency', () => {
      const result = convertCurrency(10.00, 'USD', 'USD');
      expect(result.amount).toBe(10.00);
      expect(result.convertedAmount).toBe(10.00);
      expect(result.rate).toBe(1.0);
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('USD');
    });

    it('converts USD to INR using static rate (83.0)', () => {
      const result = convertCurrency(1.00, 'USD', 'INR');
      expect(result.convertedAmount).toBeCloseTo(83.0, 1);
      expect(result.rate).toBeCloseTo(83.0, 1);
    });

    it('converts INR to USD using static rate (83.0)', () => {
      const result = convertCurrency(83.0, 'INR', 'USD');
      expect(result.convertedAmount).toBeCloseTo(1.00, 1);
      expect(result.rate).toBeCloseTo(1 / 83.0, 3);
    });

    it('converts USD to EUR using static rate (0.92)', () => {
      const result = convertCurrency(10.00, 'USD', 'EUR');
      expect(result.convertedAmount).toBeCloseTo(9.20, 1);
      expect(result.rate).toBeCloseTo(0.92, 2);
    });

    it('converts EUR to USD using static rate (0.92)', () => {
      const result = convertCurrency(10.00, 'EUR', 'USD');
      expect(result.convertedAmount).toBeCloseTo(10.87, 1);
      expect(result.rate).toBeCloseTo(1 / 0.92, 2);
    });

    it('round-trips correctly (USD -> INR -> USD)', () => {
      const forward = convertCurrency(10.00, 'USD', 'INR');
      const backward = convertCurrency(forward.convertedAmount, 'INR', 'USD');
      // Should be close to original (allowing for rounding)
      expect(backward.convertedAmount).toBeCloseTo(10.00, 1);
    });
  });

  describe('normalizeAmount', () => {
    it('is an alias for convertCurrency', () => {
      const convertResult = convertCurrency(10.00, 'USD', 'INR');
      const normalizeResult = normalizeAmount(10.00, 'USD', 'INR');
      
      expect(normalizeResult.convertedAmount).toBe(convertResult.convertedAmount);
      expect(normalizeResult.rate).toBe(convertResult.rate);
    });
  });

  describe('getExchangeRate', () => {
    it('returns 1.0 for same currency', () => {
      expect(getExchangeRate('USD', 'USD')).toBe(1.0);
      expect(getExchangeRate('INR', 'INR')).toBe(1.0);
    });

    it('returns correct rate for USD to INR', () => {
      expect(getExchangeRate('USD', 'INR')).toBeCloseTo(83.0, 1);
    });

    it('returns inverse rate for reverse conversion', () => {
      const forward = getExchangeRate('USD', 'INR');
      const reverse = getExchangeRate('INR', 'USD');
      expect(forward * reverse).toBeCloseTo(1.0, 3);
    });
  });

  describe('isValidCurrency', () => {
    it('returns true for valid currencies', () => {
      expect(isValidCurrency('USD')).toBe(true);
      expect(isValidCurrency('INR')).toBe(true);
      expect(isValidCurrency('EUR')).toBe(true);
      expect(isValidCurrency('GBP')).toBe(true);
      expect(isValidCurrency('CAD')).toBe(true);
      expect(isValidCurrency('AUD')).toBe(true);
    });

    it('returns false for invalid currencies', () => {
      expect(isValidCurrency('XYZ')).toBe(false);
      expect(isValidCurrency('')).toBe(false);
      expect(isValidCurrency('usd')).toBe(false); // Case sensitive
    });
  });
});
