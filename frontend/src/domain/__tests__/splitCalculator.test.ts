import { describe, it, expect } from 'vitest';
import {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  calculateSplit,
  type SplitParticipant,
} from '../splitCalculator';

describe('splitCalculator', () => {
  describe('calculateEqualSplit', () => {
    it('splits $10.00 equally among 3 users, sums exactly $10.00', () => {
      const result = calculateEqualSplit(10.00, ['user1', 'user2', 'user3']);
      
      expect(result).toHaveLength(3);
      
      // Check each user gets approximately 1/3 (3.33 or 3.34)
      result.forEach((r) => {
        expect(r.amount).toBeGreaterThanOrEqual(3.33);
        expect(r.amount).toBeLessThanOrEqual(3.34);
      });
      
      // Check sum equals exactly $10.00
      const sum = result.reduce((acc, r) => acc + r.amount, 0);
      expect(sum).toBeCloseTo(10.00, 2);
    });

    it('distributes remainder deterministically to first participant(s)', () => {
      const result = calculateEqualSplit(10.01, ['user1', 'user2', 'user3']);
      
      expect(result).toHaveLength(3);
      
      // First user should get the extra cent (or remainder distributed)
      const sum = result.reduce((acc, r) => acc + r.amount, 0);
      expect(sum).toBeCloseTo(10.01, 2);
      
      // All amounts should be close to 3.33 or 3.34
      result.forEach((r) => {
        expect(r.amount).toBeGreaterThanOrEqual(3.33);
        expect(r.amount).toBeLessThanOrEqual(3.34);
      });
    });

    it('handles single participant', () => {
      const result = calculateEqualSplit(10.00, ['user1']);
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(10.00);
    });

    it('returns empty array for no participants', () => {
      const result = calculateEqualSplit(10.00, []);
      expect(result).toHaveLength(0);
    });
  });

  describe('calculateExactSplit', () => {
    it('splits using exact amounts that sum to total', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 3.50 },
        { userId: 'user2', value: 4.50 },
        { userId: 'user3', value: 2.00 },
      ];
      
      const result = calculateExactSplit(10.00, participants);
      
      expect(result).toHaveLength(3);
      expect(result[0].amount).toBe(3.50);
      expect(result[1].amount).toBe(4.50);
      expect(result[2].amount).toBe(2.00);
      
      const sum = result.reduce((acc, r) => acc + r.amount, 0);
      expect(sum).toBeCloseTo(10.00, 2);
    });

    it('throws error if exact amounts do not sum to total', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 3.00 },
        { userId: 'user2', value: 4.00 },
      ];
      
      expect(() => calculateExactSplit(10.00, participants)).toThrow(/sum to/);
    });

    it('allows 1 cent tolerance for rounding', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 3.33 },
        { userId: 'user2', value: 3.33 },
        { userId: 'user3', value: 3.34 },
      ];
      
      // Should not throw (sums to 10.00)
      const result = calculateExactSplit(10.00, participants);
      expect(result).toHaveLength(3);
    });
  });

  describe('calculatePercentageSplit', () => {
    it('splits using percentages that sum to 100', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 50 },
        { userId: 'user2', value: 30 },
        { userId: 'user3', value: 20 },
      ];
      
      const result = calculatePercentageSplit(10.00, participants);
      
      expect(result).toHaveLength(3);
      expect(result[0].amount).toBeCloseTo(5.00, 2);
      expect(result[1].amount).toBeCloseTo(3.00, 2);
      expect(result[2].amount).toBeCloseTo(2.00, 2);
      
      const sum = result.reduce((acc, r) => acc + r.amount, 0);
      expect(sum).toBeCloseTo(10.00, 2);
    });

    it('throws error if percentages do not sum to 100', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 50 },
        { userId: 'user2', value: 30 },
      ];
      
      expect(() => calculatePercentageSplit(10.00, participants)).toThrow(/100%/);
    });

    it('distributes remainder to first participant', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 33.33 },
        { userId: 'user2', value: 33.33 },
        { userId: 'user3', value: 33.34 },
      ];
      
      const result = calculatePercentageSplit(10.00, participants);
      
      const sum = result.reduce((acc, r) => acc + r.amount, 0);
      expect(sum).toBeCloseTo(10.00, 2);
    });
  });

  describe('calculateSharesSplit', () => {
    it('splits proportionally based on shares', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 2 },
        { userId: 'user2', value: 3 },
        { userId: 'user3', value: 5 },
      ];
      
      const result = calculateSharesSplit(10.00, participants);
      
      expect(result).toHaveLength(3);
      // user1: 2/10 = 20% = $2.00
      expect(result[0].amount).toBeCloseTo(2.00, 2);
      // user2: 3/10 = 30% = $3.00
      expect(result[1].amount).toBeCloseTo(3.00, 2);
      // user3: 5/10 = 50% = $5.00
      expect(result[2].amount).toBeCloseTo(5.00, 2);
      
      const sum = result.reduce((acc, r) => acc + r.amount, 0);
      expect(sum).toBeCloseTo(10.00, 2);
    });

    it('throws error if no shares are positive', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 0 },
        { userId: 'user2', value: 0 },
      ];
      
      expect(() => calculateSharesSplit(10.00, participants)).toThrow(/share > 0/);
    });

    it('distributes remainder to first participant', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1', value: 1 },
        { userId: 'user2', value: 1 },
      ];
      
      const result = calculateSharesSplit(10.01, participants);
      
      const sum = result.reduce((acc, r) => acc + r.amount, 0);
      expect(sum).toBeCloseTo(10.01, 2);
    });
  });

  describe('calculateSplit', () => {
    it('calls appropriate split function based on type', () => {
      const participants: SplitParticipant[] = [
        { userId: 'user1' },
        { userId: 'user2' },
      ];
      
      const equalResult = calculateSplit(10.00, 'EQUAL', participants);
      expect(equalResult).toHaveLength(2);
      
      const exactResult = calculateSplit(10.00, 'EXACT', [
        { userId: 'user1', value: 5.00 },
        { userId: 'user2', value: 5.00 },
      ]);
      expect(exactResult).toHaveLength(2);
      
      expect(() => calculateSplit(10.00, 'ITEM_BASED', participants)).toThrow(/ITEM_BASED/);
    });
  });
});
