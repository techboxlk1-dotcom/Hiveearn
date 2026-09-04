'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Tv, CheckSquare, Gift, Ticket, Users, DollarSign, CreditCard, Trophy, Bell, Shield, Sparkles } from 'lucide-react';
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
          <p className="text-white/40 text-xs">V2 · Earn USDT</p>
        </div>
      </div>

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <GlassCard gold className="p-6 text-center">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-hive-gold/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/IMG_20260901_111414_330.jpg" alt="Hive Earn" className="w-full h-full object-cover" />
          </motion.div>
          <h2 className="text-hive-gold font-black text-2xl mb-2">Hive Earn V2</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Hive Earn is a Telegram Mini App where you earn Hive Coins by watching ads, completing tasks, claiming daily bonuses, using reward codes, and inviting friends. Coins can be withdrawn as USDT (BEP20) to your wallet.
          </p>
        </GlassCard>
      </motion.div>

      {/* Features */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
        <h3 className="text-white font-bold text-sm mb-3 px-1 flex items-center gap-2">
          <Sparkles size={14} className="text-hive-gold" /> Features
        </h3>
        <div className="space-y-2">
          {[
            { icon: Tv, label: 'Watch verified ads and earn coins' },
            { icon: CheckSquare, label: 'Complete Telegram tasks for rewards' },
            { icon: Gift, label: 'Claim daily bonus every 24 hours' },
            { icon: Ticket, label: 'Redeem reward codes for bonus coins' },
            { icon: Users, label: 'Refer friends — earn up to 1,500 coins + 5% commission' },
            { icon: DollarSign, label: 'Convert coins to USDT (1,000 coins = $0.01)' },
            { icon: CreditCard, label: 'Withdraw via USDT (BEP20) to your wallet' },
            { icon: Trophy, label: 'Leaderboard with monthly prizes' },
            { icon: Bell, label: 'Instant notifications via bot' },
            { icon: Shield, label: 'Secure anti-fraud protection' },
          ].map(({ icon: Icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
            >
              <GlassCard className="p-3" animate={false}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-hive-gold/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-hive-gold" />
                  </div>
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
          <p className="text-hive-gold font-black text-lg">1,000 coins = $0.01 USDT</p>
          <p className="text-white/40 text-xs mt-1">First withdrawal: $0.10 · Second+: $0.20</p>
        </GlassCard>
      </motion.div>

      {/* CTA */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <GlassCard gold className="p-5 text-center">
          <p className="text-white font-bold text-sm mb-4">Start earning today and grow your coin balance!</p>
          <Link href="/">
            <motion.button whileTap={{ scale: 0.95 }} className="w-full py-3 btn-hive rounded-xl font-black text-sm">
              Start Earning
            </motion.button>
          </Link>
        </GlassCard>
      </motion.div>
    </div>
  );
}
