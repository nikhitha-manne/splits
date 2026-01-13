import { type ReactNode } from 'react';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * AppLayout - Layout for authenticated app screens
 * Includes BottomNav
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
