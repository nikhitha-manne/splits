import { type ReactNode } from 'react';
import { theme } from '../theme';

interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
}

/**
 * Base SectionHeader component
 * For section titles (e.g., "People", "Groups")
 */
export function SectionHeader({ children, className = '' }: SectionHeaderProps) {
  return (
    <h3
      className={`text-md font-semibold text-gray-900 mb-3 ${className}`}
      style={{
        color: theme.colors.textPrimary,
      }}
    >
      {children}
    </h3>
  );
}
