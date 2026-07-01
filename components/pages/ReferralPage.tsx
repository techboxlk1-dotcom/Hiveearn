'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Copy, Share2, Users, CheckCircle, Clock, XCircle, Gift, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getUserReferrals, claimReferralRewards } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Referral, User } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { useAds } from '@/hooks/useAds';

interface ReferralWithUser extends Referral {
  referred: User | null;
}

export default function ReferralPage() {
  const { user, refreshUser } = useUser();
  const [referrals, setReferrals] = useState<ReferralWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unclaimedHive, setUnclaimedHive] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const { showRandomAd } = useAds();

  const loadData = useCallback(async () => {
    if (!user) return;
    const refs = await getUserReferrals(user.id);
    const withUsers = await Promise.all(
      refs.map(async r => {
        const { data: u } = await supabase.from('users').select('*').eq('id', r.referred_id).maybeSingle();
        return { ...r, referred: u };
      })
    );
    setReferrals(withUsers);
    const { data: u } = await supabase.from('users').select('unclaimed_referral_hive').eq('id', user.id).maybeSingle();
    setUnclaimedHive(u?.unclaimed_referral_hive || 0);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!user) return null;

  const referralLink = `https://t.me/Hiveearnbot/play?startapp=ref_${user.referral_code}`;
  const completed = referrals.filter(r => r.status === 'completed').length;
  const pending = referrals.filter(r => r.status === 'pending').length;
  const totalEarned = referrals.reduce((sum, r) => sum + r.total_hive_earned, 0);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink).catch(() => {});
    toast.success('Link copied!');
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: 'Join Hive Earn', text: 'Earn USDT with me on Hive Earn!', url: referralLink });
    } else {
      copyLink();
    }
  };

  const handleClaim = async () => {
    if (!user || claiming || unclaimedHive <= 0) return;
    setClaiming(true);
    try {
      const adResult = await showRandomAd();
      if (!adResult.success) {
        toast.error('Ad not played. No reward without watching an ad.');
        return;
      }
      const result = await claimReferralRewards(user.id);
      if (result.success) {
        toast.success(result.message);
        setUnclaimedHive(0);
        refreshUser?.();
        loadData();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Failed to claim rewards');
    } finally {
      setClaiming(false);
    }
  };

  const steps = [
    { hive: 25, label: 'Friend joins', sub: 'Instant reward when they sign up', done: true },
    { hive: 50, label: 'Watches 10 ads', sub: 'After first 10 ad watches', done: false },
    { hive: 75, label: 'Day 2 milestone', sub: '10 more ads on their 2nd day', done: false },
  ];

  const statusConfig = {
    pending: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Pending' },
    completed: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Completed' },
    fake: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Fake' },
    blocked: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Blocked' },
  };

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/70" />
          </motion.div>
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">Refer & Earn</h1>
          <p className="text-white/40 text-xs">Earn up to 150 Hive per referral</p>
        </div>
      </div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Refs', value: referrals.length, color: 'text-white' },
            { label: 'Completed', value: completed, color: 'text-green-400' },
            { label: 'Hive Earned', value: `${totalEarned}`, color: 'text-hive-gold' },
          ].map(({ label, value, color }) => (
            <GlassCard key={label} className="p-3 text-center" animate={false}>
              <p className={`font-black text-xl ${color}`}>{value}</p>
              <p className="text-white/40 text-[10px] font-medium">{label}</p>
            </GlassCard>
          ))}
        </div>
      </motion.div>

      {/* Unclaimed Rewards */}
      {unclaimedHive > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4">
          <GlassCard className="p-4 bg-gradient-to-br from-hive-gold/20 to-transparent border-hive-gold/30" animate={false}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-hive-gold/20 flex items-center justify-center">
                  <Gift className="text-hive-gold" size={24} />
                </div>
                <div>
                  <p className="text-white font-bold">Unclaimed Rewards</p>
                  <p className="text-hive-gold font-black text-xl">{unclaimedHive} Hive</p>
                </div>
              </div>
              <motion.button
                onClick={handleClaim}
                disabled={claiming}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 rounded-xl btn-hive font-bold text-sm flex items-center gap-2"
              >
                {claiming ? (
                  <span className="flex items-center gap-2"><Sparkles size={16} className="animate-pulse" /> Claiming...</span>
                ) : (
                  <span>Claim</span>
                )}
              </motion.button>
            </div>
            <p className="text-white/40 text-xs mt-3">Watch an ad to claim your referral rewards</p>
          </GlassCard>
        </motion.div>
      )}

      {/* Referral link */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
        <GlassCard gold glow className="p-4">
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2">Your Referral Link</p>
          <div className="flex items-center gap-2 p-3 bg-white/[0.04] rounded-xl mb-3">
            <p className="text-white/50 text-xs font-mono flex-1 truncate">{referralLink}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <motion.button onClick={copyLink} whileTap={{ scale: 0.95 }} className="flex items-center justify-center gap-2 py-3 rounded-xl btn-hive font-bold text-sm">
              <Copy size={16} /> Copy Link
            </motion.button>
            <motion.button onClick={shareLink} whileTap={{ scale: 0.95 }} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.08] border border-white/10 text-white font-bold text-sm">
              <Share2 size={16} /> Share
            </motion.button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Reward steps */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
        <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Reward Structure</h3>
        <GlassCard className="p-4" animate={false}>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-hive-gold/10 border-2 border-hive-gold/30 flex items-center justify-center">
                  <span className="text-hive-gold font-black text-xs">{i + 1}</span>
                </div>
                {i < steps.length - 1 && <div className="w-0.5 h-8 bg-white/[0.06] mt-1" />}
              </div>
              <div className="pb-4">
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-sm">{step.label}</p>
                  <span className="text-hive-gold font-black text-sm">+{step.hive} Hive</span>
                </div>
                <p className="text-white/40 text-xs mt-0.5">{step.sub}</p>
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-white/50 font-semibold text-sm">Total per referral</span>
            <span className="text-hive-gold font-black text-lg">150 Hive</span>
          </div>
          <p className="text-white/30 text-xs mt-2">⚠️ Referral must complete milestones within 48 hours</p>
        </GlassCard>
      </motion.div>

      {/* Referral list */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Your Referrals</h3>
          <span className="text-white/30 text-xs">{referrals.length} total</span>
        </div>

        {loading ? (
          <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 skeleton rounded-2xl" />)}</div>
        ) : referrals.length === 0 ? (
          <GlassCard className="p-8 text-center" animate={false}>
            <Users size={32} className="text-white/20 mx-auto mb-3" />
            <p className="text-white/30 font-medium">No referrals yet</p>
            <p className="text-white/20 text-xs mt-1">Share your link to start earning</p>
          </GlassCard>
        ) : (
          <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
            {referrals.map(ref => {
              const cfg = statusConfig[ref.status] ?? statusConfig.pending;
              const Icon = cfg.icon;
              const name = ref.referred?.first_name ?? 'Unknown';
              const username = ref.referred?.username ? `@${ref.referred.username}` : `#${ref.referred?.telegram_id}`;
              return (
                <div key={ref.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
                      <span className="text-white/60 font-bold text-sm">{name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-white/80 text-sm font-medium">{name}</p>
                      <p className="text-white/30 text-[10px]">{username} • {timeAgo(ref.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ref.total_hive_earned > 0 && (
                      <span className="text-hive-gold text-xs font-bold">+{ref.total_hive_earned}H</span>
                    )}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${cfg.bg}`}>
                      <Icon size={10} className={cfg.color} />
                      <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </GlassCard>
        )}
      </motion.div>
    </div>
  );
}
