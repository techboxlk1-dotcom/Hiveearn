'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Users, PlayCircle, Gift, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getTopEarners, getTopReferrers, getTopAdWatchers, getMonthlyLeaderboard, claimLeaderboardPrize } from '@/lib/api';
import type { User } from '@/lib/supabase';
import { formatHive } from '@/lib/utils';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';

type LeaderboardTab = 'earners' | 'referrers' | 'adwatchers' | 'monthly';

const medalColors = ['text-yellow-400', 'text-gray-300', 'text-orange-600'];
const medalEmoji = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { user, refreshUser } = useUser();
  const { showReward } = useRewardPopup();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('earners');
  const [earners, setEarners] = useState<Array<User & { rank: number }>>([]);
  const [referrers, setReferrers] = useState<Array<{ user: User; count: number; rank: number }>>([]);
  const [adwatchers, setAdwatchers] = useState<Array<{ user: User; count: number; rank: number }>>([]);
  const [monthly, setMonthly] = useState<{ earners: Array<{ id: string; user: User; rank: number; value: number; prize: number; claimed: boolean }>; referrers: Array<{ id: string; user: User; rank: number; value: number; prize: number; claimed: boolean }> }>({ earners: [], referrers: [] });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getTopEarners(), getTopReferrers(), getTopAdWatchers(), getMonthlyLeaderboard()]).then(([e, r, a, m]) => {
      setEarners(e);
      setReferrers(r);
      setAdwatchers(a);
      setMonthly(m);
      setLoading(false);
    });
  }, []);

  const tabs = [
    { id: 'earners' as const, label: 'Earners', icon: Trophy },
    { id: 'referrers' as const, label: 'Referrals', icon: Users },
    { id: 'adwatchers' as const, label: 'Ad Watch', icon: PlayCircle },
    { id: 'monthly' as const, label: 'Monthly', icon: Gift },
  ];

  const userRank = earners.find(e => e.id === user?.id)?.rank;

  const handleClaim = async (entryId: string, prize: number, rank: number) => {
    if (!user || claiming) return;
    setClaiming(entryId);
    try {
      const res = await claimLeaderboardPrize(user.id, entryId);
      if (res.success) {
        toast.success(`+${res.hive} Hive claimed!`);
        showReward(res.hive, 'Leaderboard Prize!', `Rank #${rank} — ${res.hive} Hive`, '🏆');
        const m = await getMonthlyLeaderboard();
        setMonthly(m);
        await refreshUser();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to claim prize');
    } finally {
      setClaiming(null);
    }
  };

  const renderEntry = (rank: number, u: User, value: string, sub?: string) => {
    const isCurrentUser = u.id === user?.id;
    const displayName = u.username ? `@${u.username}` : u.first_name;

    return (
      <motion.div
        key={u.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: (rank - 1) * 0.04 }}
        className={`flex items-center gap-3 p-3 rounded-xl ${isCurrentUser ? 'bg-hive-gold/10 border border-hive-gold/20' : ''}`}
      >
        <div className="w-8 flex-shrink-0 text-center">
          {rank <= 3 ? (
            <span className="text-xl">{medalEmoji[rank - 1]}</span>
          ) : (
            <span className={`font-black text-sm ${medalColors[2] ?? 'text-white/40'}`}>{rank}</span>
          )}
        </div>

        <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {u.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.photo_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white/60 font-bold text-sm">{(u.first_name ?? 'U')[0]?.toUpperCase()}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-hive-gold' : 'text-white/80'}`}>
            {displayName}{isCurrentUser && ' (You)'}
          </p>
          {sub && <p className="text-white/30 text-[10px]">{sub}</p>}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-hive-gold font-black text-sm">{value}</p>
        </div>
      </motion.div>
    );
  };

  const renderMonthlyEntry = (rank: number, u: User, value: string, prize: number, claimed: boolean, entryId: string) => {
    const isCurrentUser = u.id === user?.id;
    const displayName = u.username ? `@${u.username}` : u.first_name;

    return (
      <motion.div
        key={u.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: (rank - 1) * 0.04 }}
        className={`flex items-center gap-3 p-3 rounded-xl ${isCurrentUser ? 'bg-hive-gold/10 border border-hive-gold/20' : ''}`}
      >
        <div className="w-8 flex-shrink-0 text-center">
          {rank <= 3 ? (
            <span className="text-xl">{medalEmoji[rank - 1]}</span>
          ) : (
            <span className={`font-black text-sm ${medalColors[2] ?? 'text-white/40'}`}>{rank}</span>
          )}
        </div>

        <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {u.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={u.photo_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white/60 font-bold text-sm">{(u.first_name ?? 'U')[0]?.toUpperCase()}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${isCurrentUser ? 'text-hive-gold' : 'text-white/80'}`}>
            {displayName}{isCurrentUser && ' (You)'}
          </p>
          <p className="text-white/30 text-[10px]">{value} {prize > 0 && `• Prize: ${prize} 🍯`}</p>
        </div>

        <div className="text-right flex-shrink-0">
          {prize > 0 && isCurrentUser && !claimed && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleClaim(entryId, prize, rank)}
              disabled={claiming === entryId}
              className="px-3 py-1.5 btn-hive rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {claiming === entryId ? '...' : 'Claim'}
            </motion.button>
          )}
          {claimed && isCurrentUser && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/15 rounded-lg">
              <CheckCircle2 size={12} className="text-green-400" />
              <span className="text-green-400 text-[10px] font-bold">Claimed</span>
            </div>
          )}
        </div>
      </motion.div>
    );
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
          <h1 className="text-white font-bold text-lg">Leaderboard</h1>
          <p className="text-white/40 text-xs">Top performers</p>
        </div>
      </div>

      {/* Podium top 3 */}
      {activeTab === 'earners' && earners.length >= 3 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-end justify-center gap-3">
            {[earners[1], earners[0], earners[2]].map((e, i) => {
              const heights = ['h-20', 'h-28', 'h-16'];
              const actualRank = [2, 1, 3][i];
              return (
                <div key={e.id} className={`flex flex-col items-center ${i === 1 ? 'scale-110' : ''}`}>
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-hive-gold/30 bg-hive-gold/10 mb-1">
                    {e.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.photo_url} alt={e.first_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-hive-gold font-black">{e.first_name[0]}</div>
                    )}
                  </div>
                  <p className="text-white/60 text-[9px] font-medium text-center max-w-[60px] truncate">{e.username ?? e.first_name}</p>
                  <p className="text-hive-gold text-[9px] font-black">{formatHive(e.hive_balance)}H</p>
                  <div className={`${heights[i]} w-16 rounded-t-xl mt-1 flex items-end justify-center pb-2 ${i === 1 ? 'bg-gradient-to-t from-hive-gold/30 to-hive-gold/10 border border-hive-gold/20' : 'bg-white/[0.06] border border-white/10'}`}>
                    <span className="text-xl">{medalEmoji[actualRank - 1]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Your rank */}
      {userRank && activeTab === 'earners' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <GlassCard gold className="p-3 flex items-center justify-between">
            <span className="text-white/60 text-sm">Your Rank</span>
            <span className="text-hive-gold font-black text-lg">#{userRank}</span>
          </GlassCard>
        </motion.div>
      )}

      {/* Monthly prize banner */}
      {activeTab === 'monthly' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <GlassCard className="p-4 text-center" animate={false}>
            <Gift size={28} className="text-hive-gold mx-auto mb-2" />
            <p className="text-white font-bold text-sm">Monthly Referral Leaderboard</p>
            <p className="text-hive-gold font-black text-xl mt-1">50,000 🍯 Hive Prize Pool</p>
            <p className="text-white/40 text-[10px] mt-1">Top 10 referrers share the prize! Claim your prize from the list below.</p>
          </GlassCard>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 p-1 bg-white/[0.04] rounded-2xl overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className="relative flex-1 min-w-[70px] py-2.5 rounded-xl text-xs font-semibold transition-all">
            {activeTab === id && <motion.div layoutId="lb-tab" className="absolute inset-0 btn-hive rounded-xl" />}
            <span className={`relative z-10 flex items-center justify-center gap-1 ${activeTab === id ? 'text-black' : 'text-white/50'}`}>
              <Icon size={12} /> {label}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div>
      ) : (
        <GlassCard className="p-2 space-y-1" animate={false}>
          {activeTab === 'earners' && earners.map(e =>
            renderEntry(e.rank, e, `${formatHive(e.hive_balance)} H`)
          )}
          {activeTab === 'referrers' && referrers.map(({ user: u, count, rank }) =>
            renderEntry(rank, u, `${count} refs`)
          )}
          {activeTab === 'adwatchers' && adwatchers.map(({ user: u, count, rank }) =>
            renderEntry(rank, u, `${count} ads`)
          )}
          {activeTab === 'monthly' && (
            <>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold px-2 pt-2 pb-1">🏆 Top Referrers — 50,000 Hive Pool</p>
              {monthly.referrers.length === 0 && <p className="text-white/30 text-xs text-center py-4">No monthly data yet. Admin needs to generate.</p>}
              {monthly.referrers.map((entry) => {
                return renderMonthlyEntry(entry.rank, entry.user, `${entry.value} refs`, entry.prize, entry.claimed, entry.id);
              })}
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold px-2 pt-4 pb-1">💰 Top Earners</p>
              {monthly.earners.length === 0 && <p className="text-white/30 text-xs text-center py-4">No monthly data yet.</p>}
              {monthly.earners.map((entry) => {
                return renderMonthlyEntry(entry.rank, entry.user, `${formatHive(entry.value)} H`, entry.prize, entry.claimed, entry.id);
              })}
            </>
          )}
          {((activeTab === 'earners' && earners.length === 0) ||
            (activeTab === 'referrers' && referrers.length === 0) ||
            (activeTab === 'adwatchers' && adwatchers.length === 0)) && (
            <div className="py-12 text-center">
              <Trophy size={32} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/30">No data yet</p>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
