import { describe, it, expect } from 'vitest';
import { toCents, fromCents, addCents, subtractCents, multiplyCents, divideCents } from '../money';

describe('money utilities', () => {
  describe('toCents', () => {
    it('converts decimal dollars to integer cents', () => {
      expect(toCents(1.00)).toBe(100);
      expect(toCents(10.50)).toBe(1050);
      expect(toCents(0.01)).toBe(1);
      expect(toCents(0.99)).toBe(99);
    });

    it('rounds to nearest cent', () => {
      expect(toCents(1.999)).toBe(200);
      expect(toCents(1.001)).toBe(100);
    });
  });

  describe('fromCents', () => {
    it('converts integer cents to decimal dollars', () => {
      expect(fromCents(100)).toBe(1.00);
      expect(fromCents(1050)).toBe(10.50);
      expect(fromCents(1)).toBe(0.01);
      expect(fromCents(99)).toBe(0.99);
    });
  });

  describe('addCents', () => {
    it('adds two cent amounts', () => {
      expect(addCents(100, 50)).toBe(150);
      expect(addCents(0, 100)).toBe(100);
      expect(addCents(100, -50)).toBe(50);
    });
  });

  describe('subtractCents', () => {
    it('subtracts two cent amounts', () => {
      expect(subtractCents(100, 50)).toBe(50);
      expect(subtractCents(50, 100)).toBe(-50);
      expect(subtractCents(100, 100)).toBe(0);
    });
  });

  describe('multiplyCents', () => {
    it('multiplies cent amount by multiplier', () => {
      expect(multiplyCents(100, 2)).toBe(200);
      expect(multiplyCents(100, 0.5)).toBe(50);
      expect(multiplyCents(100, 0)).toBe(0);
    });
  });

  describe('divideCents', () => {
    it('divides cent amount by divisor', () => {
      expect(divideCents(100, 2)).toBe(50);
      expect(divideCents(100, 4)).toBe(25);
      expect(divideCents(100, 3)).toBe(33); // Rounds to nearest
    });

    it('throws error on division by zero', () => {
      expect(() => divideCents(100, 0)).toThrow('Division by zero');
    });
  });
});
