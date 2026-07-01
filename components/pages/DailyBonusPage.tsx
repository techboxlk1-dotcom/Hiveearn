'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gift, CheckCircle, Clock, Zap } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { claimDailyBonus } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { DailyBonusClaim } from '@/lib/supabase';
import { timeAgo, canClaimDailyBonus, hoursUntilNextBonus } from '@/lib/utils';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';
import { useAds } from '@/hooks/useAds';

export default function DailyBonusPage() {
  const { showReward } = useRewardPopup();
  const { user, refreshUser } = useUser();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [history, setHistory] = useState<DailyBonusClaim[]>([]);
  const [lastClaim, setLastClaim] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { showRandomAd } = useAds();

  useEffect(() => {
    if (!user) return;
    supabase.from('daily_bonus_claims').select('*').eq('user_id', user.id).order('claimed_at', { ascending: false }).limit(14)
      .then(({ data }) => {
        setHistory(data ?? []);
        if (data && data.length > 0) setLastClaim(data[0].claimed_at);
      });
  }, [user]);

  const canClaim = canClaimDailyBonus(lastClaim);
  const hoursLeft = lastClaim ? hoursUntilNextBonus(lastClaim) : 0;

  const handleClaim = async () => {
    if (!user || claiming || !canClaim) return;
    setClaiming(true);
    try {
      const adResult = await showRandomAd();
      if (!adResult.success) {
        toast.error('Ad not played. No reward without watching an ad.');
        return;
      }
      const result = await claimDailyBonus(user.id);
      if (result.success) {
        setClaimed(true);
        setShowConfetti(true);
        await refreshUser();
        const now = new Date().toISOString();
        setLastClaim(now);
        setHistory(prev => [{ id: 'new', user_id: user.id, hive_earned: result.hive, streak_day: (prev.length) + 1, claimed_at: now }, ...prev]);
        toast.success(`+${result.hive} Hive earned!`, { icon: '🍯' });
        showReward(result.hive, 'Daily Bonus!', 'Come back tomorrow for more', '🎁');
        setTimeout(() => { setClaimed(false); setShowConfetti(false); }, 3000);
      } else {
        toast.error(result.message);
      }
    } finally {
      setClaiming(false);
    }
  };

  const streakDay = history.length + (canClaim ? 1 : 0);

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/70" />
          </motion.div>
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">Daily Bonus</h1>
          <p className="text-white/40 text-xs">Claim your daily reward</p>
        </div>
      </div>

      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-sm"
                style={{ left: `${Math.random() * 100}%`, background: ['#F5C518', '#FFB300', '#FF6B6B', '#4ECDC4', '#45B7D1'][Math.floor(Math.random() * 5)] }}
                initial={{ top: '-5%', rotate: 0, opacity: 1 }}
                animate={{ top: '110%', rotate: 720, opacity: 0 }}
                transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.5 }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main claim card */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6">
        <GlassCard gold glow className="p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-hive-gold/8 to-orange-500/5 pointer-events-none" />

          {/* Bee animation */}
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [-3, 3, -3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-4"
          >
            🐝
          </motion.div>

          <h2 className="text-white font-black text-2xl mb-1">Daily Bonus</h2>
          <p className="text-hive-gold font-bold text-xl mb-4">+10 HIVE</p>

          {/* Streak */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.06] rounded-full mb-6">
            <Zap size={14} className="text-hive-gold" />
            <span className="text-white/70 text-sm">Day <span className="text-hive-gold font-bold">{Math.min(streakDay, 30)}</span> streak</span>
          </div>

          {/* Claim button */}
          <AnimatePresence mode="wait">
            {canClaim ? (
              <motion.button
                key="claim"
                onClick={handleClaim}
                disabled={claiming}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                className="btn-hive w-full py-4 text-lg font-black rounded-2xl relative overflow-hidden"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {claiming ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full" />
                    Claiming...
                  </span>
                ) : claimed ? (
                  <span className="flex items-center justify-center gap-2">
                    <CheckCircle size={20} /> Claimed!
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Gift size={20} /> Claim 10 Hive
                  </span>
                )}
              </motion.button>
            ) : (
              <motion.div
                key="cooldown"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full py-4 rounded-2xl bg-white/[0.06] border border-white/10 text-center"
              >
                <div className="flex items-center justify-center gap-2 text-white/50">
                  <Clock size={18} />
                  <span className="font-semibold">Come back in {hoursLeft}h</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      {/* Weekly calendar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
        <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">This Week</h3>
        <GlassCard className="p-4" animate={false}>
          <div className="grid grid-cols-7 gap-2">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
              const isDone = i < Math.min(history.length, 7);
              const isToday = i === Math.min(history.length, 6) && canClaim;
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-white/30 text-[10px]">{day}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDone ? 'bg-hive-gold text-black' : isToday ? 'border-2 border-hive-gold/50 bg-hive-gold/10' : 'bg-white/[0.05]'}`}>
                    {isDone ? <CheckCircle size={14} /> : <span className="text-white/20 text-xs">—</span>}
                  </div>
                  <span className="text-hive-gold text-[9px] font-bold">{isDone ? '+10' : ''}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* History */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">History</h3>
          <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
            {history.slice(0, 10).map((claim, i) => (
              <div key={claim.id || i} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-hive-gold/10 flex items-center justify-center">
                    <Gift size={14} className="text-hive-gold" />
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-medium">Day {claim.streak_day} Bonus</p>
                    <p className="text-white/30 text-[10px]">{timeAgo(claim.claimed_at)}</p>
                  </div>
                </div>
                <span className="text-hive-gold font-bold text-sm">+{claim.hive_earned} H</span>
              </div>
            ))}
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
