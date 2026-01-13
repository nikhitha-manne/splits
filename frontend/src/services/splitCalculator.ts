/**
 * Split calculator - compatibility exports from domain module
 * @deprecated Use domain/splitCalculator directly
 */

// Re-export from domain module for backward compatibility
export {
  type SplitType,
  type SplitParticipant,
  type SplitResult,
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  calculateSplit,
} from '../domain/splitCalculator';
