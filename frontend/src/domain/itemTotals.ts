/**
 * Item totals computation - pure domain logic using cents internally
 */

import { toCents, fromCents, addCents, subtractCents } from './money';

export interface BillItem {
  id: string;
  name: string;
  price: number; // Decimal
  orderIndex: number;
}

export interface ItemAssignment {
  userId: string;
  share: number; // Decimal amount of this item assigned to this user
}

/**
 * Compute total owed amounts per user from items and their assignments (pure function using cents internally)
 */
export function computeItemTotals(
  items: BillItem[],
  itemAssignments: Map<string, ItemAssignment[]>
): Map<string, number> {
  const totalsCents = new Map<string, number>();

  for (const item of items) {
    const assignments = itemAssignments.get(item.id) || [];
    
    // Convert item price to cents
    const itemPriceCents = toCents(item.price);
    
    // Skip validation if no assignments (item just won't contribute to totals)
    if (assignments.length === 0) {
      continue;
    }
    
    // Sum up assignments for this item
    let assignedCents = 0;
    for (const assignment of assignments) {
      const shareCents = toCents(assignment.share);
      assignedCents = addCents(assignedCents, shareCents);
      
      // Add to user's total
      const currentTotalCents = totalsCents.get(assignment.userId) || 0;
      totalsCents.set(assignment.userId, addCents(currentTotalCents, shareCents));
    }
    
    // Validate that assignments sum to item price (allow 1 cent tolerance for rounding)
    const differenceCents = Math.abs(subtractCents(itemPriceCents, assignedCents));
    if (differenceCents > 1) {
      throw new Error(
        `Item "${item.name}" assignments sum to ${fromCents(assignedCents).toFixed(2)}, but item price is ${item.price.toFixed(2)}`
      );
    }
  }

  // Convert back to decimals
  const totals = new Map<string, number>();
  for (const [userId, totalCents] of totalsCents.entries()) {
    totals.set(userId, fromCents(totalCents));
  }

  return totals;
}

/**
 * Validate that all items are fully assigned
 */
export function validateItemAssignments(
  items: BillItem[],
  itemAssignments: Map<string, ItemAssignment[]>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const item of items) {
    const assignments = itemAssignments.get(item.id) || [];
    const itemPriceCents = toCents(item.price);
    const assignedCents = assignments.reduce((sum, a) => addCents(sum, toCents(a.share)), 0);
    const differenceCents = Math.abs(subtractCents(itemPriceCents, assignedCents));
    
    if (differenceCents > 1) {
      errors.push(
        `Item "${item.name}": assignments sum to ${fromCents(assignedCents).toFixed(2)}, but item price is ${item.price.toFixed(2)}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
