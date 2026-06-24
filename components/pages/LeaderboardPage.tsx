'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Users, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getTopEarners, getTopReferrers, getTopAdWatchers } from '@/lib/api';
import type { User } from '@/lib/supabase';
import { formatHive, hiveToUsdt, formatUsdt } from '@/lib/utils';

type LeaderboardTab = 'earners' | 'referrers' | 'adwatchers';

const medalColors = ['text-yellow-400', 'text-gray-300', 'text-orange-600'];
const medalEmoji = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('earners');
  const [earners, setEarners] = useState<Array<User & { rank: number }>>([]);
  const [referrers, setReferrers] = useState<Array<{ user: User; count: number; rank: number }>>([]);
  const [adwatchers, setAdwatchers] = useState<Array<{ user: User; count: number; rank: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getTopEarners('all'), getTopReferrers(), getTopAdWatchers()]).then(([e, r, a]) => {
      setEarners(e);
      setReferrers(r);
      setAdwatchers(a);
      setLoading(false);
    });
  }, []);

  const tabs = [
    { id: 'earners' as const, label: 'Top Earners', icon: Trophy },
    { id: 'referrers' as const, label: 'Referrals', icon: Users },
    { id: 'adwatchers' as const, label: 'Ad Watchers', icon: PlayCircle },
  ];

  const userRank = earners.find(e => e.id === user?.id)?.rank;

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
              const sizes = ['w-14', 'w-18', 'w-14'];
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

      {/* Tabs */}
      <div className="flex gap-2 mb-5 p-1 bg-white/[0.04] rounded-2xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} className="relative flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all">
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
            renderEntry(e.rank, e, `${formatHive(e.hive_balance)} H`, formatUsdt(hiveToUsdt(e.hive_balance)) + ' USDT')
          )}
          {activeTab === 'referrers' && referrers.map(({ user: u, count, rank }) =>
            renderEntry(rank, u, `${count} refs`)
          )}
          {activeTab === 'adwatchers' && adwatchers.map(({ user: u, count, rank }) =>
            renderEntry(rank, u, `${count} ads`)
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
