'use client';

import { useUser } from '@/contexts/UserContext';
import BottomNav from './BottomNav';
import SplashScreen from '@/components/SplashScreen';
import { motion } from 'framer-motion';
import { ShieldOff } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

export default function AppShell({ children, hideNav = false }: AppShellProps) {
  const { isLoading, user } = useUser();

  if (isLoading) return <SplashScreen />;

  // Hard block — suspended users see nothing except this screen
  if (user?.is_suspended) {
    return (
      <div className="min-h-dvh bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="flex flex-col items-center gap-5"
        >
          {/* Red glow background */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-3xl bg-red-500/20 scale-150" />
            <div className="relative w-24 h-24 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <ShieldOff size={40} className="text-red-400" />
            </div>
          </div>

          <div>
            <h1 className="text-white font-black text-2xl mb-2">Account Suspended</h1>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Your account has been suspended and all actions are disabled.
            </p>
          </div>

          {user.suspension_reason && (
            <div className="w-full max-w-xs p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Reason</p>
              <p className="text-red-300 text-sm font-medium">{user.suspension_reason}</p>
            </div>
          )}

          <div className="w-full max-w-xs p-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-widest">Contact Support</p>
            <a
              href="https://t.me/hiveearn"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-300 text-sm font-semibold"
            >
              📨 Contact @hiveearn
            </a>
          </div>

          <p className="text-white/20 text-xs">Hive Earn — ID: {user.telegram_id}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0A0A0A] honeycomb-bg">
      <main className={hideNav ? '' : 'pb-nav'}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
