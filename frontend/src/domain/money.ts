/**
 * Money utilities - work with integer cents internally to avoid float drift
 */

/**
 * Convert decimal dollars to integer cents
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert integer cents to decimal dollars (rounded to 2 decimal places)
 */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Safe addition in cents (returns cents)
 */
export function addCents(a: number, b: number): number {
  return Math.round(a) + Math.round(b);
}

/**
 * Safe subtraction in cents (returns cents)
 */
export function subtractCents(a: number, b: number): number {
  return Math.round(a) - Math.round(b);
}

/**
 * Safe multiplication in cents (amount * multiplier, returns cents)
 */
export function multiplyCents(amountCents: number, multiplier: number): number {
  return Math.round(Math.round(amountCents) * multiplier);
}

/**
 * Safe division in cents (amountCents / divisor, returns cents)
 */
export function divideCents(amountCents: number, divisor: number): number {
  if (divisor === 0) {
    throw new Error('Division by zero');
  }
  return Math.round(Math.round(amountCents) / divisor);
}

/**
 * Round amount to nearest cent (returns cents)
 */
export function roundToCents(amountCents: number): number {
  return Math.round(amountCents);
}

/**
 * Format cents as decimal dollars with 2 decimal places
 */
export function formatCents(cents: number): number {
  return fromCents(Math.round(cents));
}
