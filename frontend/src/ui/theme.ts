/**
 * Design tokens for Splitwise-like UI
 * Minimal, subtle design system tokens
 */

export const theme = {
  colors: {
    background: '#F8F9FA', // subtle warm off-white
    surface: '#ffffff', // white
    textPrimary: '#111827', // near-black - matches text-gray-900
    textSecondary: '#6b7280', // muted gray - matches text-gray-500
    positive: '#059669', // muted green (not neon) - matches text-green-600
    negative: '#dc2626', // muted red - matches text-red-600
    border: '#e5e7eb', // very light gray - matches border-gray-200
  },
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem', // 8px
    md: '1rem', // 16px
    lg: '1.5rem', // 24px
    xl: '2rem', // 32px
  },
  radius: {
    sm: '0.25rem', // 4px
    md: '0.5rem', // 8px
    lg: '0.75rem', // 12px
  },
  shadow: {
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', // subtle card shadow
  },
} as const;

export type Theme = typeof theme;
