'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wallet, History, Users, Trophy, Settings, LogOut, Bell, Globe, ChevronRight, Shield, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import HiveBalance from '@/components/ui/HiveBalance';
import { getWallet } from '@/lib/api';
import { truncateAddress, formatUsdt, hiveToUsdt } from '@/lib/utils';

export default function ProfilePage() {
  const { user, isAdmin } = useUser();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    if (user) getWallet(user.id).then(w => setWalletAddress(w?.address ?? null));
  }, [user]);

  if (!user) return null;

  const displayName = user.first_name + (user.last_name ? ` ${user.last_name}` : '');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type MenuItem = { icon: React.ComponentType<any>; label: string; href: string; color: string; bg: string; badge?: string; external?: boolean };

  const menuSections: Array<{ title: string; items: MenuItem[] }> = [
    {
      title: 'Finance',
      items: [
        { icon: Wallet, label: 'Wallet & Withdraw', href: '/wallet', color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { icon: History, label: 'Transaction History', href: '/transactions', color: 'text-green-400', bg: 'bg-green-400/10' },
      ],
    },
    {
      title: 'Social',
      items: [
        { icon: Users, label: 'Refer & Earn', href: '/referral', color: 'text-purple-400', bg: 'bg-purple-400/10' },
        { icon: Trophy, label: 'Leaderboard', href: '/leaderboard', color: 'text-hive-gold', bg: 'bg-hive-gold/10' },
      ],
    },
    {
      title: 'Community',
      items: [
        { icon: ExternalLink, label: 'Community Channel', href: 'https://t.me/hiveearn', color: 'text-blue-300', bg: 'bg-blue-300/10', external: true },
        { icon: ExternalLink, label: 'Payment Channel', href: 'https://t.me/hiveearnpayment', color: 'text-green-300', bg: 'bg-green-300/10', external: true },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: Bell, label: 'Notifications', href: '/notifications', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
        { icon: Globe, label: 'Language', href: '#', color: 'text-white/60', bg: 'bg-white/10', badge: user.language.toUpperCase() },
        { icon: Info, label: 'About Hive Earn', href: '#', color: 'text-white/60', bg: 'bg-white/10' },
      ],
    },
    ...(isAdmin ? [{
      title: 'Admin',
      items: [
        { icon: Shield, label: 'Admin Panel', href: '/admin', color: 'text-red-400', bg: 'bg-red-400/10' },
      ] as MenuItem[],
    }] : []),
  ];

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <div className="relative inline-block mb-4">
          <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-hive-gold/40 bg-hive-gold/10 flex items-center justify-center mx-auto">
            {user.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photo_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-hive-gold font-black text-3xl">{displayName[0]?.toUpperCase()}</span>
            )}
          </div>
          {isAdmin && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 border-2 border-[#0A0A0A] flex items-center justify-center">
              <Shield size={12} className="text-white" />
            </div>
          )}
        </div>
        <h1 className="text-white font-black text-xl">{displayName}</h1>
        {user.username && <p className="text-hive-gold text-sm font-medium">@{user.username}</p>}
        <p className="text-white/30 font-mono text-xs mt-1">ID: {user.telegram_id}</p>
        {user.is_suspended && (
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-500/15 rounded-full mt-2">
            <span className="text-red-400 text-xs font-bold">Account Suspended</span>
          </div>
        )}
      </motion.div>

      {/* Balance */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
        <GlassCard gold glow className="p-4 text-center">
          <HiveBalance amount={user.hive_balance} size="lg" />
        </GlassCard>
      </motion.div>

      {/* Wallet */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
        <Link href="/wallet">
          <GlassCard className="p-4 flex items-center justify-between" hover3d>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Wallet size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white/50 text-xs">BEP20 Wallet</p>
                <p className="text-white font-medium text-sm">{walletAddress ? truncateAddress(walletAddress) : 'Not connected'}</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-white/30" />
          </GlassCard>
        </Link>
      </motion.div>

      {/* Menu sections */}
      <div className="space-y-5">
        {menuSections.map((section, si) => (
          <motion.div key={section.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + si * 0.05 }}>
            <h3 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-2 px-1">{section.title}</h3>
            <GlassCard className="overflow-hidden divide-y divide-white/[0.04]" animate={false}>
              {section.items.map(({ icon: Icon, label, href, color, bg, badge, external }) => {
                const content = (
                  <motion.div whileTap={{ scale: 0.98 }} className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors">
                    <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={16} className={color} />
                    </div>
                    <span className="text-white/80 text-sm font-medium flex-1">{label}</span>
                    {badge && <span className="text-white/40 text-xs font-mono">{badge}</span>}
                    <ChevronRight size={14} className="text-white/20" />
                  </motion.div>
                );
                return external ? (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer">{content}</a>
                ) : (
                  <Link key={label} href={href}>{content}</Link>
                );
              })}
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Member since */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 text-center">
        <p className="text-white/20 text-xs">Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </motion.div>
    </div>
  );
}
