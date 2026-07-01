'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Tv, CheckSquare, Gift, Ticket, Users, DollarSign, CreditCard, Trophy, Bell, Shield } from 'lucide-react';
import Link from 'next/link';
import GlassCard from '@/components/ui/GlassCard';

export default function AboutPage() {
  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/profile">
          <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/70" />
          </motion.div>
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">About Hive Earn</h1>
          <p className="text-white/40 text-xs">Mini App About</p>
        </div>
      </div>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <GlassCard gold className="p-6 text-center">
          <div className="text-5xl mb-3">🐝</div>
          <h2 className="text-hive-gold font-black text-2xl mb-2">Welcome to Hive Earn!</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Hive Earn is a Telegram Mini App where you can earn Hive Tokens by watching ads, completing Telegram tasks, claiming daily bonuses, using reward codes, and inviting friends.
          </p>
        </GlassCard>
      </motion.div>

      {/* Features */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
        <h3 className="text-white font-bold text-sm mb-3 px-1">✨ Features</h3>
        <div className="space-y-2">
          {[
            { icon: Tv, emoji: '📺', label: 'Watch Ads & Earn Hive' },
            { icon: CheckSquare, emoji: '✅', label: 'Complete Telegram Tasks' },
            { icon: Gift, emoji: '🎁', label: 'Daily Bonus Rewards' },
            { icon: Ticket, emoji: '🎟️', label: 'Reward Code System' },
            { icon: Users, emoji: '👥', label: 'Refer Friends & Earn More' },
            { icon: DollarSign, emoji: '💰', label: 'Convert Hive to USDT' },
            { icon: CreditCard, emoji: '💳', label: 'Withdraw via USDT (BEP20)' },
            { icon: Trophy, emoji: '🏆', label: 'Leaderboard' },
            { icon: Bell, emoji: '🔔', label: 'Instant Notifications' },
            { icon: Shield, emoji: '🛡️', label: 'Secure Anti-Fraud Protection' },
          ].map(({ emoji, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
            >
              <GlassCard className="p-3" animate={false}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{emoji}</span>
                  <span className="text-white/80 text-sm font-medium">{label}</span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Rate info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
        <GlassCard className="p-4 text-center" animate={false}>
          <p className="text-hive-gold font-black text-lg">100 Hive = $0.01 USDT</p>
        </GlassCard>
      </motion.div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard gold className="p-5 text-center">
          <p className="text-white font-bold text-sm mb-4">Start earning today and grow your Hive balance!</p>
          <Link href="/">
            <motion.button whileTap={{ scale: 0.95 }} className="w-full py-3 btn-hive rounded-xl font-black text-sm">
              🐝 Start Earning
            </motion.button>
          </Link>
        </GlassCard>
      </motion.div>
    </div>
  );
}
