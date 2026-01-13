import { type ReactNode } from 'react';
import { theme } from '../theme';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * Base Card component
 * Minimal, composable card with subtle shadow
 */
export function Card({ children, className = '', onClick }: CardProps) {
  const interactiveClasses = onClick ? 'cursor-pointer hover:border-blue-400 transition-colors' : '';

  return (
    <div
      className={`bg-white border ${interactiveClasses} ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.card,
        borderColor: theme.colors.border,
      }}
    >
      {children}
    </div>
  );
}
