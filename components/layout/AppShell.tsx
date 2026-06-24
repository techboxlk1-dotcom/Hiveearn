'use client';

import { useUser } from '@/contexts/UserContext';
import BottomNav from './BottomNav';
import SplashScreen from '@/components/SplashScreen';

interface AppShellProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

export default function AppShell({ children, hideNav = false }: AppShellProps) {
  const { isLoading } = useUser();

  if (isLoading) return <SplashScreen />;

  return (
    <div className="min-h-dvh bg-[#0A0A0A] honeycomb-bg">
      <main className={hideNav ? '' : 'pb-nav'}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
