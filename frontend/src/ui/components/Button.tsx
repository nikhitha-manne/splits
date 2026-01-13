import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { theme } from '../theme';

type ButtonVariant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

/**
 * Base Button component
 * Supports primary and ghost variants only
 */
export function Button({ children, variant = 'primary', className = '', disabled, ...props }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

  const variantClasses = {
    primary: disabled
      ? 'bg-blue-600 text-white opacity-50 cursor-not-allowed'
      : 'bg-blue-600 text-white hover:bg-blue-700',
    ghost: disabled
      ? 'bg-gray-200 text-gray-700 opacity-50 cursor-not-allowed'
      : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      style={{
        borderRadius: theme.radius.md,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
