import { theme } from '../theme';

interface BalanceTextProps {
  amount: number; // netAmount (positive = owed to you, negative = you owe)
  currency: string;
  className?: string;
}

/**
 * Base BalanceText component
 * Displays balance with appropriate color (green for positive, red for negative, gray for zero)
 */
export function BalanceText({ amount, currency, className = '' }: BalanceTextProps) {
  const formatCurrency = (amount: number, currencyCode: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const absAmount = Math.abs(amount);
  const isPositive = amount > 0.01;
  const isNegative = amount < -0.01;
  const isZero = !isPositive && !isNegative;

  let color: string;
  let text: string;

  if (isZero) {
    color = theme.colors.textSecondary;
    text = 'Settled up';
  } else if (isPositive) {
    color = theme.colors.positive;
    text = `You are owed ${formatCurrency(absAmount, currency)}`;
  } else {
    color = theme.colors.negative;
    text = `You owe ${formatCurrency(absAmount, currency)}`;
  }

  return (
    <span className={`text-sm font-medium ${className}`} style={{ color }}>
      {text}
    </span>
  );
}
