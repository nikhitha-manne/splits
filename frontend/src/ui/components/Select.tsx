import { type SelectHTMLAttributes, forwardRef } from 'react';
import { theme } from '../theme';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/**
 * Base Select component
 * Minimal select dropdown with error state support
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error = false, ...props }, ref) => {
    const baseClasses = 'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

    const errorClasses = error ? 'border-red-300' : 'border-gray-300';

    return (
      <select
        ref={ref}
        className={`${baseClasses} ${errorClasses} ${className}`}
        style={{
          borderRadius: theme.radius.md,
          borderColor: error ? theme.colors.negative : theme.colors.border,
        }}
        {...props}
      />
    );
  }
);

Select.displayName = 'Select';
