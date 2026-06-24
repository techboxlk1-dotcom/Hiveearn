'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, PlayCircle, CheckSquare, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/ads', icon: PlayCircle, label: 'Ads' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/referral', icon: Users, label: 'Refer' },
  { href: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="bg-[#0D0D0D]/95 backdrop-blur-2xl border-t border-white/[0.06] px-2 py-2">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className="flex-1">
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  className={cn(
                    'flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition-all duration-200',
                    isActive ? 'text-hive-gold' : 'text-white/40'
                  )}
                >
                  <div className="relative">
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-hive-gold/15 rounded-lg -m-1"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <Icon size={22} className={cn('relative z-10', isActive && 'drop-shadow-[0_0_8px_rgba(245,197,24,0.6)]')} />
                  </div>
                  <span className={cn('text-[10px] font-semibold tracking-wide', isActive ? 'text-hive-gold' : 'text-white/40')}>
                    {label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
