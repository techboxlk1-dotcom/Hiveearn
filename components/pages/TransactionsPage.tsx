'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getUserTransactions } from '@/lib/api';
import type { Transaction } from '@/lib/supabase';
import { formatHive, timeAgo } from '@/lib/utils';

const TX_TYPES = ['all', 'ad', 'task', 'referral', 'daily_bonus', 'reward_code', 'withdraw', 'deposit'] as const;
type TxFilter = typeof TX_TYPES[number];

const txMeta: Record<string, { label: string; icon: string; color: string }> = {
  ad: { label: 'Ad Watch', icon: '📺', color: 'text-blue-400' },
  task: { label: 'Task', icon: '✅', color: 'text-green-400' },
  referral: { label: 'Referral', icon: '👥', color: 'text-purple-400' },
  daily_bonus: { label: 'Daily Bonus', icon: '🎁', color: 'text-orange-400' },
  reward_code: { label: 'Reward Code', icon: '⚡', color: 'text-pink-400' },
  withdraw: { label: 'Withdrawal', icon: '💸', color: 'text-red-400' },
  deposit: { label: 'Deposit', icon: '💰', color: 'text-green-400' },
  adjustment: { label: 'Adjustment', icon: '⚙️', color: 'text-yellow-400' },
  reward: { label: 'Reward', icon: '🏆', color: 'text-hive-gold' },
};

export default function TransactionsPage() {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<TxFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadTxs = useCallback(async (reset = false) => {
    if (!user) return;
    const offset = reset ? 0 : page * 20;
    setLoading(true);
    const txs = await getUserTransactions(user.id, filter === 'all' ? undefined : filter, 20, offset);
    if (reset) { setTransactions(txs); setPage(0); }
    else { setTransactions(prev => [...prev, ...txs]); }
    setHasMore(txs.length === 20);
    setLoading(false);
  }, [user, filter, page]);

  useEffect(() => { loadTxs(true); }, [user, filter]);

  const filtered = search
    ? transactions.filter(tx => (tx.description ?? '').toLowerCase().includes(search.toLowerCase()) || tx.type.includes(search.toLowerCase()))
    : transactions;

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/wallet">
          <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/70" />
          </motion.div>
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">Transactions</h1>
          <p className="text-white/40 text-xs">Your complete history</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search transactions..."
          className="w-full pl-10 pr-4 py-3 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30 transition-all"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {TX_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filter === type ? 'bg-hive-gold text-black' : 'bg-white/[0.06] text-white/50'
            }`}
          >
            {type === 'all' ? 'All' : txMeta[type]?.label ?? type}
          </button>
        ))}
      </div>

      {/* Transactions */}
      {loading && transactions.length === 0 ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/20 text-4xl mb-3">📋</p>
          <p className="text-white/30 font-medium">No transactions found</p>
        </div>
      ) : (
        <div>
          <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
            {filtered.map(tx => {
              const meta = txMeta[tx.type] ?? { label: tx.type, icon: '⭐', color: 'text-white' };
              return (
                <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 p-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center text-xl flex-shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{tx.description ?? meta.label}</p>
                    <p className="text-white/30 text-[10px]">{timeAgo(tx.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatHive(tx.amount)} H
                    </p>
                    <p className={`text-[10px] capitalize ${meta.color}`}>{meta.label}</p>
                  </div>
                </motion.div>
              );
            })}
          </GlassCard>

          {hasMore && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setPage(p => p + 1); loadTxs(); }}
              disabled={loading}
              className="w-full mt-3 py-3 rounded-xl glass-card text-white/50 text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
