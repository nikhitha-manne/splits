/**
 * Split calculator - pure domain logic using cents internally
 */

import { toCents, fromCents, addCents, subtractCents, multiplyCents, divideCents } from './money';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES' | 'ITEM_BASED';

export interface SplitParticipant {
  userId: string;
  value?: number; // For EXACT: amount, PERCENTAGE: percentage, SHARES: shares
}

export interface SplitResult {
  userId: string;
  amount: number; // Amount in expense currency (decimal)
}

/**
 * Calculate splits for EQUAL distribution (using cents internally)
 */
export function calculateEqualSplit(
  totalAmount: number,
  participantIds: string[]
): SplitResult[] {
  if (participantIds.length === 0) {
    return [];
  }

  // Convert to cents for precision
  const totalCents = toCents(totalAmount);
  const numParticipants = participantIds.length;

  // Calculate per-person amount in cents
  const amountPerPersonCents = divideCents(totalCents, numParticipants);
  
  // Calculate remainder
  const totalDistributedCents = multiplyCents(amountPerPersonCents, numParticipants);
  const remainderCents = subtractCents(totalCents, totalDistributedCents);

  // Distribute remainder to first participant(s) to ensure sum equals totalAmount
  const results: SplitResult[] = participantIds.map((userId, index) => {
    let amountCents = amountPerPersonCents;
    // Distribute remainder one cent at a time
    if (index < Math.abs(remainderCents)) {
      amountCents = addCents(amountCents, remainderCents > 0 ? 1 : -1);
    }
    return {
      userId,
      amount: fromCents(amountCents),
    };
  });

  // Verify sum equals total (should always be true with cents math)
  const sumCents = results.reduce((acc, r) => addCents(acc, toCents(r.amount)), 0);
  const differenceCents = subtractCents(totalCents, sumCents);
  
  // Adjust first result if there's any remainder (should be minimal)
  if (Math.abs(differenceCents) > 0) {
    results[0].amount = fromCents(addCents(toCents(results[0].amount), differenceCents));
  }

  return results;
}

/**
 * Calculate splits for EXACT amounts (using cents internally)
 */
export function calculateExactSplit(
  totalAmount: number,
  participants: SplitParticipant[]
): SplitResult[] {
  const results: SplitParticipant[] = participants.filter((p) => p.value !== undefined);

  // Convert to cents for precision
  const totalCents = toCents(totalAmount);
  const sumCents = results.reduce((acc, p) => addCents(acc, toCents(p.value || 0)), 0);
  const differenceCents = Math.abs(subtractCents(totalCents, sumCents));

  // Allow 1 cent tolerance for rounding
  if (differenceCents > 1) {
    throw new Error(`Exact amounts sum to ${fromCents(sumCents).toFixed(2)}, but expense total is ${totalAmount.toFixed(2)}`);
  }

  return results.map((p) => ({
    userId: p.userId,
    amount: p.value || 0,
  }));
}

/**
 * Calculate splits for PERCENTAGE distribution (using cents internally)
 */
export function calculatePercentageSplit(
  totalAmount: number,
  participants: SplitParticipant[]
): SplitResult[] {
  const results: SplitParticipant[] = participants.filter((p) => p.value !== undefined);

  // Validate percentages sum to 100
  const totalPercentage = results.reduce((acc, p) => acc + (p.value || 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error(`Percentages sum to ${totalPercentage.toFixed(2)}%, but must equal 100%`);
  }

  // Convert to cents for precision
  const totalCents = toCents(totalAmount);

  // Calculate amounts in cents
  const splitResultsCents = results.map((p) => {
    const percentage = p.value || 0;
    // Calculate: (totalCents * percentage) / 100
    const amountCents = divideCents(multiplyCents(totalCents, percentage), 100);
    return {
      userId: p.userId,
      amountCents,
    };
  });

  // Round each to cents and calculate remainder
  const roundedResultsCents = splitResultsCents.map((r) => ({
    userId: r.userId,
    amountCents: Math.round(r.amountCents),
  }));

  const sumCents = roundedResultsCents.reduce((acc, r) => addCents(acc, r.amountCents), 0);
  const remainderCents = subtractCents(totalCents, sumCents);

  // Distribute remainder to first result
  if (Math.abs(remainderCents) > 0) {
    roundedResultsCents[0].amountCents = addCents(roundedResultsCents[0].amountCents, remainderCents);
  }

  // Convert back to decimals
  return roundedResultsCents.map((r) => ({
    userId: r.userId,
    amount: fromCents(r.amountCents),
  }));
}

/**
 * Calculate splits for SHARES distribution (using cents internally)
 */
export function calculateSharesSplit(
  totalAmount: number,
  participants: SplitParticipant[]
): SplitResult[] {
  const results: SplitParticipant[] = participants.filter((p) => p.value !== undefined && (p.value || 0) > 0);

  if (results.length === 0) {
    throw new Error('At least one participant must have a share > 0');
  }

  // Calculate total shares
  const totalShares = results.reduce((acc, p) => acc + (p.value || 0), 0);
  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than 0');
  }

  // Convert to cents for precision
  const totalCents = toCents(totalAmount);

  // Calculate proportional amounts in cents
  const splitResultsCents = results.map((p) => {
    const share = p.value || 0;
    // Calculate: (totalCents * share) / totalShares
    const amountCents = divideCents(multiplyCents(totalCents, share), totalShares);
    return {
      userId: p.userId,
      amountCents,
    };
  });

  // Round each to cents and calculate remainder
  const roundedResultsCents = splitResultsCents.map((r) => ({
    userId: r.userId,
    amountCents: Math.round(r.amountCents),
  }));

  const sumCents = roundedResultsCents.reduce((acc, r) => addCents(acc, r.amountCents), 0);
  const remainderCents = subtractCents(totalCents, sumCents);

  // Distribute remainder to first result
  if (Math.abs(remainderCents) > 0) {
    roundedResultsCents[0].amountCents = addCents(roundedResultsCents[0].amountCents, remainderCents);
  }

  // Convert back to decimals
  return roundedResultsCents.map((r) => ({
    userId: r.userId,
    amount: fromCents(r.amountCents),
  }));
}

/**
 * Main split calculation function
 */
export function calculateSplit(
  totalAmount: number,
  splitType: SplitType,
  participants: SplitParticipant[]
): SplitResult[] {
  switch (splitType) {
    case 'EQUAL':
      return calculateEqualSplit(
        totalAmount,
        participants.map((p) => p.userId)
      );
    case 'EXACT':
      return calculateExactSplit(totalAmount, participants);
    case 'PERCENTAGE':
      return calculatePercentageSplit(totalAmount, participants);
    case 'SHARES':
      return calculateSharesSplit(totalAmount, participants);
    case 'ITEM_BASED':
      // ITEM_BASED splits are computed from bill items and assignments
      throw new Error('ITEM_BASED splits must be computed from bill items and assignments');
    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}
