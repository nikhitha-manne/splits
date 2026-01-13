import { describe, it, expect } from 'vitest';
import { computeItemTotals, validateItemAssignments, type BillItem, type ItemAssignment } from '../itemTotals';

describe('itemTotals', () => {
  describe('computeItemTotals', () => {
    it('computes totals correctly from items and assignments', () => {
      const items: BillItem[] = [
        { id: 'item1', name: 'Item 1', price: 5.00, orderIndex: 0 },
        { id: 'item2', name: 'Item 2', price: 3.00, orderIndex: 1 },
        { id: 'item3', name: 'Item 3', price: 2.00, orderIndex: 2 },
      ];

      const assignmentsMap = new Map<string, ItemAssignment[]>([
        ['item1', [{ userId: 'user1', share: 3.00 }, { userId: 'user2', share: 2.00 }]],
        ['item2', [{ userId: 'user1', share: 1.50 }, { userId: 'user2', share: 1.50 }]],
        ['item3', [{ userId: 'user2', share: 2.00 }]],
      ]);

      const totals = computeItemTotals(items, assignmentsMap);

      expect(totals.get('user1')).toBeCloseTo(4.50, 2); // 3.00 + 1.50
      expect(totals.get('user2')).toBeCloseTo(5.50, 2); // 2.00 + 1.50 + 2.00
    });

    it('handles empty items list', () => {
      const items: BillItem[] = [];
      const assignmentsMap = new Map<string, ItemAssignment[]>();
      const totals = computeItemTotals(items, assignmentsMap);
      expect(totals.size).toBe(0);
    });

    it('handles items with no assignments', () => {
      const items: BillItem[] = [
        { id: 'item1', name: 'Item 1', price: 5.00, orderIndex: 0 },
      ];
      const assignmentsMap = new Map<string, ItemAssignment[]>();
      const totals = computeItemTotals(items, assignmentsMap);
      expect(totals.size).toBe(0);
    });

    it('throws error if item assignments do not sum to item price', () => {
      const items: BillItem[] = [
        { id: 'item1', name: 'Item 1', price: 5.00, orderIndex: 0 },
      ];
      const assignmentsMap = new Map<string, ItemAssignment[]>([
        ['item1', [{ userId: 'user1', share: 3.00 }, { userId: 'user2', share: 1.00 }]], // Sums to 4.00, not 5.00
      ]);

      expect(() => computeItemTotals(items, assignmentsMap)).toThrow(/sum to/);
    });

    it('allows 1 cent tolerance for rounding errors', () => {
      const items: BillItem[] = [
        { id: 'item1', name: 'Item 1', price: 5.00, orderIndex: 0 },
      ];
      const assignmentsMap = new Map<string, ItemAssignment[]>([
        ['item1', [{ userId: 'user1', share: 3.33 }, { userId: 'user2', share: 1.67 }]], // Sums to 5.00 (with rounding)
      ]);

      // Should not throw
      const totals = computeItemTotals(items, assignmentsMap);
      expect(totals.get('user1')).toBeCloseTo(3.33, 2);
      expect(totals.get('user2')).toBeCloseTo(1.67, 2);
    });
  });

  describe('validateItemAssignments', () => {
    it('returns valid for correctly assigned items', () => {
      const items: BillItem[] = [
        { id: 'item1', name: 'Item 1', price: 5.00, orderIndex: 0 },
        { id: 'item2', name: 'Item 2', price: 3.00, orderIndex: 1 },
      ];
      const assignmentsMap = new Map<string, ItemAssignment[]>([
        ['item1', [{ userId: 'user1', share: 3.00 }, { userId: 'user2', share: 2.00 }]],
        ['item2', [{ userId: 'user1', share: 3.00 }]],
      ]);

      const result = validateItemAssignments(items, assignmentsMap);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns errors for incorrectly assigned items', () => {
      const items: BillItem[] = [
        { id: 'item1', name: 'Item 1', price: 5.00, orderIndex: 0 },
        { id: 'item2', name: 'Item 2', price: 3.00, orderIndex: 1 },
      ];
      const assignmentsMap = new Map<string, ItemAssignment[]>([
        ['item1', [{ userId: 'user1', share: 3.00 }, { userId: 'user2', share: 1.00 }]], // Sums to 4.00, not 5.00
        ['item2', [{ userId: 'user1', share: 3.00 }]], // Correct
      ]);

      const result = validateItemAssignments(items, assignmentsMap);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Item 1');
    });

    it('returns valid for empty items', () => {
      const items: BillItem[] = [];
      const assignmentsMap = new Map<string, ItemAssignment[]>();
      const result = validateItemAssignments(items, assignmentsMap);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
