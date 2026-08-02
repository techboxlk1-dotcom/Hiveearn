'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Bell, Gift, Trophy, Megaphone, ChevronRight, Wallet, PlayCircle, CheckSquare, Users, Zap, Copy, ExternalLink, Pickaxe, Timer } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import HiveBalance from '@/components/ui/HiveBalance';
import { formatHive, hiveToUsdt, formatUsdt, timeAgo } from '@/lib/utils';
import { getAnnouncements, getUserTransactions, startMining, claimMining, getMiningStatus } from '@/lib/api';
import type { Announcement, Transaction } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAds } from '@/hooks/useAds';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function HomePage() {
  const { user, unreadCount } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { showAutoAd, startAdWithTimer, getMinWatchTime } = useAds();
  const initialAdShown = useRef(false);
  const earnTouchCount = useRef(0);
  const [miningStatus, setMiningStatus] = useState<{ isMining: boolean; startedAt: string | null; elapsedHours: number; pendingHive: number }>({ isMining: false, startedAt: null, elapsedHours: 0, pendingHive: 0 });
  const [miningLoading, setMiningLoading] = useState(false);
  const [miningTick, setMiningTick] = useState(0);

  useEffect(() => {
    getAnnouncements().then(setAnnouncements);
    if (user) getUserTransactions(user.id, undefined, 5).then(setTransactions);
  }, [user]);

  // Load mining status
  useEffect(() => {
    if (!user) return;
    getMiningStatus(user.id).then(setMiningStatus);
  }, [user]);

  // Tick every second to update mining timer
  useEffect(() => {
    if (!miningStatus.isMining) return;
    const interval = setInterval(() => setMiningTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [miningStatus.isMining]);

  const handleStartMining = useCallback(async () => {
    if (!user || miningLoading) return;
    setMiningLoading(true);
    try {
      // Show AdsGram ad before starting mining
      const adsgramProvider = { id: 'adsgram', slug: 'adsgram', name: 'AdsGram', reward_per_ad: 0, daily_limit: 999, network_type: 'adsgram' } as const;
      await startAdWithTimer(adsgramProvider);

      const res = await startMining(user.id);
      if (res.success) {
        toast.success('⛏️ Mining started! +20 Hive every hour!');
        setMiningStatus(await getMiningStatus(user.id));
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to start mining');
    } finally {
      setMiningLoading(false);
    }
  }, [user, miningLoading, startAdWithTimer]);

  const handleClaimMining = useCallback(async () => {
    if (!user || miningLoading) return;
    setMiningLoading(true);
    try {
      // Show AdsGram ad before claiming
      const adsgramProvider = { id: 'adsgram', slug: 'adsgram', name: 'AdsGram', reward_per_ad: 0, daily_limit: 999, network_type: 'adsgram' } as const;
      await startAdWithTimer(adsgramProvider);

      const res = await claimMining(user.id);
      if (res.success) {
        toast.success(`+${res.hive} Hive mined!`);
        setMiningStatus(await getMiningStatus(user.id));
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to claim mining');
    } finally {
      setMiningLoading(false);
    }
  }, [user, miningLoading, startAdWithTimer]);

  // Auto-open ad on mini app launch
  useEffect(() => {
    if (!user || initialAdShown.current) return;
    initialAdShown.current = true;
    showAutoAd();
  }, [user, showAutoAd]);

  const handleEarnMoreTouch = useCallback(() => {
    earnTouchCount.current += 1;
    if (earnTouchCount.current % 3 === 0) {
      showAutoAd();
    }
  }, [showAutoAd]);

  if (!user) return null;

  const displayName = user.username ? `@${user.username}` : user.first_name;
  const usdtBalance = hiveToUsdt(user.hive_balance);
  const referralLink = `https://t.me/Hiveearnbot/play?startapp=ref_${user.referral_code}`;

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink).catch(() => {});
    toast.success('Referral link copied!');
  };

  const quickActions = [
    { icon: Gift, label: 'Daily Bonus', href: '/daily', color: 'text-green-400', bg: 'bg-green-400/10' },
    { icon: Zap, label: 'Reward Code', href: '/reward-code', color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { icon: Wallet, label: 'Withdraw', href: '/wallet', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { icon: Trophy, label: 'Leaderboard', href: '/leaderboard', color: 'text-hive-gold', bg: 'bg-hive-gold/10' },
    { icon: Gift, label: 'Giveaway', href: '/giveaway', color: 'text-pink-400', bg: 'bg-pink-400/10' },
  ];

  const txTypeColor: Record<string, string> = {
    ad: 'text-blue-400', task: 'text-green-400', referral: 'text-purple-400',
    daily_bonus: 'text-orange-400', reward_code: 'text-pink-400', withdraw: 'text-red-400',
    deposit: 'text-green-400', adjustment: 'text-yellow-400', reward: 'text-hive-gold',
  };

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <motion.div whileTap={{ scale: 0.9 }} className="relative">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-hive-gold/30 bg-hive-gold/10 flex items-center justify-center">
              {user.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photo_url} alt={user.first_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-hive-gold font-black text-lg">{user.first_name[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-[#0A0A0A]" />
          </motion.div>
          <div>
            <p className="text-white/50 text-xs">Welcome back</p>
            <p className="text-white font-bold text-sm">{displayName}</p>
          </div>
        </div>
        <Link href="/notifications">
          <motion.div whileTap={{ scale: 0.9 }} className="relative w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <Bell size={18} className="text-white/70" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-hive-gold text-black text-[10px] font-black flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.div>
        </Link>
      </motion.div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        {/* Balance Card */}
        <motion.div variants={item}>
          <GlassCard gold glow className="p-5 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-hive-gold/5 to-transparent pointer-events-none" />
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Your Balance</p>
            <HiveBalance amount={user.hive_balance} size="xl" />
            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/[0.06]">
              <div className="text-center">
                <p className="text-white/40 text-xs">USDT Value</p>
                <p className="text-green-400 font-bold">{formatUsdt(usdtBalance)} USDT</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-white/40 text-xs">Telegram ID</p>
                <p className="text-white/70 font-mono text-sm">{user.telegram_id}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Mining Card */}
        <motion.div variants={item}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center">
                  <Pickaxe size={18} className="text-hive-gold" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Hive Mining</p>
                  <p className="text-hive-gold text-xs font-semibold">+20 Hive / hour</p>
                </div>
              </div>
              {miningStatus.isMining && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-500/15 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-[10px] font-bold">ACTIVE</span>
                </div>
              )}
            </div>

            {miningStatus.isMining ? (
              <div>
                <div className="flex items-center justify-between mb-3 p-3 bg-white/[0.04] rounded-xl">
                  <div className="flex items-center gap-2">
                    <Timer size={16} className="text-hive-gold" />
                    <span className="text-white/60 text-xs font-mono">
                      {(() => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                        miningTick; // trigger re-render
                        if (!miningStatus.startedAt) return '00:00:00';
                        const elapsedMs = Date.now() - new Date(miningStatus.startedAt).getTime();
                        const h = Math.floor(elapsedMs / 3600000);
                        const m = Math.floor((elapsedMs % 3600000) / 60000);
                        const s = Math.floor((elapsedMs % 60000) / 1000);
                        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                      })()}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-[10px]">Pending</p>
                    <p className="text-hive-gold font-bold text-sm">{(() => { // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                      miningTick; return Math.floor((Date.now() - new Date(miningStatus.startedAt!).getTime()) / 3600000) * 20; })()} Hive</p>
                  </div>
                </div>
                <motion.button
                  onClick={handleClaimMining}
                  disabled={miningLoading}
                  whileTap={{ scale: 0.96 }}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' }}
                >
                  {miningLoading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full" /> : <Pickaxe size={16} />}
                  {miningLoading ? 'Processing...' : 'Claim Mining Reward'}
                </motion.button>
              </div>
            ) : (
              <motion.button
                onClick={handleStartMining}
                disabled={miningLoading}
                whileTap={{ scale: 0.96 }}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' }}
              >
                {miningLoading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full" /> : <Pickaxe size={16} />}
                {miningLoading ? 'Starting...' : 'Start Mining — 20 Hive/hr'}
              </motion.button>
            )}
          </GlassCard>
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={item}>
          <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map(({ icon: Icon, label, href, color, bg }) => (
              <Link key={href} href={href}>
                <motion.div whileTap={{ scale: 0.88 }} className="flex flex-col items-center gap-2 p-3 rounded-2xl glass-card hover:border-hive-gold/20 transition-all">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon size={18} className={color} />
                  </div>
                  <span className="text-white/60 text-[10px] font-semibold text-center leading-tight">{label}</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Earn Actions */}
        <motion.div variants={item} onClick={handleEarnMoreTouch}>
          <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Earn More</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: PlayCircle, label: 'Watch Ads', sub: 'Up to 10 Hive', href: '/ads', color: 'from-blue-900/40 to-blue-800/20' },
              { icon: CheckSquare, label: 'Tasks', sub: '20-200 Hive', href: '/tasks', color: 'from-green-900/40 to-green-800/20' },
              { icon: Users, label: 'Refer', sub: 'Up to 150 Hive', href: '/referral', color: 'from-purple-900/40 to-purple-800/20' },
            ].map(({ icon: Icon, label, sub, href, color }) => (
              <Link key={href} href={href}>
                <motion.div whileTap={{ scale: 0.92 }} className={`p-3 rounded-2xl bg-gradient-to-br ${color} border border-white/[0.08] flex flex-col gap-2 h-full`}>
                  <Icon size={20} className="text-white/80" />
                  <div>
                    <p className="text-white font-bold text-xs">{label}</p>
                    <p className="text-hive-gold text-[10px] font-medium">{sub}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Referral Quick Share */}
        <motion.div variants={item}>
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-purple-400" />
                <span className="text-white font-semibold text-sm">Your Referral Link</span>
              </div>
              <span className="text-xs text-hive-gold font-semibold">+150 Hive</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-white/[0.04] rounded-xl">
              <p className="text-white/50 text-xs font-mono flex-1 truncate">{referralLink}</p>
              <motion.button whileTap={{ scale: 0.85 }} onClick={copyReferral} className="text-hive-gold flex-shrink-0">
                <Copy size={16} />
              </motion.button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <motion.div variants={item}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Recent Activity</h3>
              <Link href="/transactions" className="text-hive-gold text-xs flex items-center gap-1">See all <ChevronRight size={12} /></Link>
            </div>
            <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-white/80 text-xs font-medium capitalize">{tx.description ?? tx.type.replace('_', ' ')}</p>
                    <p className="text-white/30 text-[10px]">{timeAgo(tx.created_at)}</p>
                  </div>
                  <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'} ${txTypeColor[tx.type]}`}>
                    {tx.amount > 0 ? '+' : ''}{formatHive(tx.amount)} 🍯
                  </span>
                </div>
              ))}
            </GlassCard>
          </motion.div>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <motion.div variants={item}>
            <div className="flex items-center gap-2 mb-3">
              <Megaphone size={14} className="text-hive-gold" />
              <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Announcements</h3>
            </div>
            <div className="space-y-2">
              {announcements.slice(0, 3).map(a => (
                <GlassCard key={a.id} className="p-3" animate={false}>
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === 'success' ? 'bg-green-400' : a.type === 'warning' ? 'bg-yellow-400' : a.type === 'promotion' ? 'bg-pink-400' : 'bg-blue-400'}`} />
                    <div>
                      <p className="text-white/80 text-xs font-semibold">{a.title}</p>
                      <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{a.content}</p>
                    </div>
                    {a.pinned && <span className="text-hive-gold text-[10px] font-bold ml-auto flex-shrink-0">📌</span>}
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        )}

        {/* Community */}
        <motion.div variants={item}>
          <GlassCard className="p-4">
            <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">Community</h3>
            <div className="grid grid-cols-2 gap-3">
              <a href="https://t.me/hiveearn" target="_blank" rel="noopener noreferrer">
                <motion.div whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-1.5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <span className="text-xl">📢</span>
                  <span className="text-blue-300 text-xs font-semibold">Community</span>
                  <span className="text-blue-400/60 text-[10px]">Join Channel</span>
                </motion.div>
              </a>
              <a href="https://t.me/hiveearnpayment" target="_blank" rel="noopener noreferrer">
                <motion.div whileTap={{ scale: 0.95 }} className="flex flex-col items-center gap-1.5 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <span className="text-xl">💳</span>
                  <span className="text-green-300 text-xs font-semibold">Payments</span>
                  <span className="text-green-400/60 text-[10px]">View Proofs</span>
                </motion.div>
              </a>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
