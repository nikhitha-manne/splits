import { type InputHTMLAttributes, forwardRef } from 'react';
import { theme } from '../theme';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/**
 * Base Input component
 * Minimal text input with error state support
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error = false, ...props }, ref) => {
    const baseClasses = 'w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

    const errorClasses = error ? 'border-red-300' : 'border-gray-300';

    return (
      <input
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

Input.displayName = 'Input';
