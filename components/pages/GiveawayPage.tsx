'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Gift, Users, Clock, Baby, Trophy, Sparkles, PlayCircle, History, CheckCircle, Dices, Gamepad2 } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getActiveGiveaways, getAllGiveaways, getEndedGiveaways, getGiveawayWinHistory, participateGiveaway, getGiveawayParticipation, getBabyHiveBalance, type Giveaway } from '@/lib/api';
import type { GiveawayWin } from '@/lib/api';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';
import GiveawayAdsSection from './GiveawayAdsSection';
import SpinWheel from './SpinWheel';
import MiniGame from './MiniGame';

type GiveawayTab = 'available' | 'all' | 'ended' | 'wins' | 'earn' | 'spin' | 'game';

export default function GiveawayPage() {
  const { user, refreshUser } = useUser();
  const { showReward } = useRewardPopup();
  const [activeTab, setActiveTab] = useState<GiveawayTab>('available');
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [participation, setParticipation] = useState<Record<string, boolean>>({});
  const [babyHiveBalance, setBabyHiveBalance] = useState(0);
  const [winHistory, setWinHistory] = useState<GiveawayWin[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const [active, parts, balance, wins] = await Promise.all([
      getActiveGiveaways(),
      getGiveawayParticipation(user.id),
      getBabyHiveBalance(user.id),
      getGiveawayWinHistory(user.id),
    ]);
    setGiveaways(active);
    setParticipation(parts);
    setBabyHiveBalance(balance);
    setWinHistory(wins);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const loadTabData = useCallback(async (tab: GiveawayTab) => {
    if (!user) return;
    setLoading(true);
    if (tab === 'available') {
      const active = await getActiveGiveaways();
      setGiveaways(active);
    } else if (tab === 'all') {
      const all = await getAllGiveaways();
      setGiveaways(all);
    } else if (tab === 'ended') {
      const ended = await getEndedGiveaways();
      setGiveaways(ended);
    } else if (tab === 'wins') {
      const wins = await getGiveawayWinHistory(user.id);
      setWinHistory(wins);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (activeTab === 'earn') return;
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const handleJoin = async (giveaway: Giveaway) => {
    if (!user || joining) return;
    const amount = selectedAmount[giveaway.id] ?? giveaway.min_baby_hive;
    if (amount < giveaway.min_baby_hive) {
      toast.error(`Minimum ${giveaway.min_baby_hive} Baby Hive required`);
      return;
    }
    if (babyHiveBalance < amount) {
      toast.error(`You only have ${babyHiveBalance} Baby Hive`);
      return;
    }
    setJoining(giveaway.id);
    try {
      const res = await participateGiveaway(user.id, giveaway.id, amount);
      if (res.success) {
        toast.success('Successfully joined giveaway!');
        showReward(0, 'Giveaway Joined!', `You joined "${giveaway.title}" with ${amount} Baby Hive`, '🎁');
        await load();
        await refreshUser();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error('Failed to join giveaway');
    } finally {
      setJoining(null);
    }
  };

  const tabs: { id: GiveawayTab; label: string; icon: typeof Gift }[] = [
    { id: 'available', label: 'Available', icon: Gift },
    { id: 'all', label: 'All', icon: Users },
    { id: 'ended', label: 'Ended', icon: Clock },
    { id: 'wins', label: 'Win History', icon: Trophy },
    { id: 'earn', label: 'Earn Baby Hive', icon: Baby },
    { id: 'spin', label: 'Spin', icon: Dices },
    { id: 'game', label: 'Game', icon: Gamepad2 },
  ];

  const renderGiveawayCard = (g: Giveaway, index: number) => {
    const isParticipating = participation[g.id];
    const amount = selectedAmount[g.id] ?? g.min_baby_hive;
    const isEnded = g.status === 'ended' || g.status === 'distributed';

    return (
      <motion.div key={g.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
        <GlassCard className="overflow-hidden" animate={false}>
          {g.image_url && (
            <div className="relative h-32 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.image_url} alt={g.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent" />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-white font-bold text-sm">{g.title}</h3>
                {g.description && <p className="text-white/40 text-xs mt-0.5">{g.description}</p>}
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-hive-gold/10 rounded-full">
                <Trophy size={10} className="text-hive-gold" />
                <span className="text-hive-gold text-[10px] font-bold">{g.fund_baby_hive} H</span>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-3 text-xs">
              <div className="flex items-center gap-1 text-white/40">
                <Users size={12} /> {g.participant_count}{g.max_participants ? `/${g.max_participants}` : ''} joined
              </div>
              <div className="flex items-center gap-1 text-white/40">
                <Baby size={12} /> Min {g.min_baby_hive} 🍼
              </div>
              {isEnded && (
                <div className="flex items-center gap-1 text-orange-400">
                  <Clock size={12} /> Ended
                </div>
              )}
            </div>

            {isEnded ? (
              <div className="flex items-center justify-center gap-2 py-3 bg-white/[0.04] rounded-xl">
                <Clock size={16} className="text-white/40" />
                <span className="text-white/40 text-sm font-bold">Giveaway Ended</span>
              </div>
            ) : isParticipating ? (
              <>
                <div className="flex items-center justify-center gap-2 py-2.5 bg-green-500/10 rounded-xl mb-2">
                  <Sparkles size={16} className="text-green-400" />
                  <span className="text-green-400 text-sm font-bold">You&apos;re participating!</span>
                </div>
                <div className="mb-2">
                  <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Add more Baby Hive</label>
                  <div className="flex items-center gap-2">
                    {[g.min_baby_hive, g.min_baby_hive * 2, g.min_baby_hive * 5].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setSelectedAmount(prev => ({ ...prev, [g.id]: amt }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${amount === amt ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}
                      >
                        +{amt} 🍼
                      </button>
                    ))}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleJoin(g)}
                  disabled={joining === g.id || babyHiveBalance < g.min_baby_hive}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' }}
                >
                  {joining === g.id ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full" />
                  ) : (
                    <Gift size={16} />
                  )}
                  {babyHiveBalance < g.min_baby_hive ? 'Not enough Baby Hive' : `Add ${amount} 🍼 More`}
                </motion.button>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Baby Hive to contribute</label>
                  <div className="flex items-center gap-2">
                    {[g.min_baby_hive, g.min_baby_hive * 2, g.min_baby_hive * 5].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setSelectedAmount(prev => ({ ...prev, [g.id]: amt }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${amount === amt ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'}`}
                      >
                        {amt} 🍼
                      </button>
                    ))}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleJoin(g)}
                  disabled={joining === g.id || babyHiveBalance < g.min_baby_hive}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' }}
                >
                  {joining === g.id ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full" />
                  ) : (
                    <Gift size={16} />
                  )}
                  {babyHiveBalance < g.min_baby_hive ? 'Not enough Baby Hive' : `Join with ${amount} 🍼`}
                </motion.button>
              </>
            )}
          </div>
        </GlassCard>
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
          <h1 className="text-white font-bold text-lg">Giveaways</h1>
          <p className="text-white/40 text-xs">Join with Baby Hive to win Hive</p>
        </div>
      </div>

      {/* Baby Hive Balance Card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <GlassCard className="p-4" animate={false}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <Baby size={24} className="text-pink-400" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Baby Hive Balance</p>
                <p className="text-pink-400 font-black text-2xl">{babyHiveBalance} 🍼</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/30 text-[10px]">Earn 100 per ad</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveTab('earn')}
                className="mt-1 px-3 py-1.5 bg-pink-500/15 text-pink-400 text-[10px] font-bold rounded-lg"
              >
                Earn Baby Hive →
              </motion.button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
          >
            {activeTab === id && <motion.div layoutId="giveaway-tab" className="absolute inset-0 btn-hive rounded-xl" />}
            <span className={`relative z-10 flex items-center gap-1.5 ${activeTab === id ? 'text-black' : 'text-white/50'}`}>
              <Icon size={12} />
              {label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'earn' ? (
          <motion.div key="earn" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <GiveawayAdsSection />
          </motion.div>
        ) : activeTab === 'spin' ? (
          <motion.div key="spin" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <SpinWheel />
          </motion.div>
        ) : activeTab === 'game' ? (
          <motion.div key="game" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            <MiniGame />
          </motion.div>
        ) : activeTab === 'wins' ? (
          <motion.div key="wins" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}</div>
            ) : winHistory.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Trophy size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No wins yet</p>
                <p className="text-xs mt-1">Join giveaways to win Hive!</p>
              </div>
            ) : (
              winHistory.map((win, index) => (
                <motion.div key={win.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
                  <GlassCard className="p-4" animate={false}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center">
                          <Trophy size={18} className="text-hive-gold" />
                        </div>
                        <div>
                          <p className="text-white font-bold text-sm">{win.giveaway_title}</p>
                          <p className="text-white/40 text-xs">Contributed {win.baby_hive_amount} 🍼</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-hive-gold font-black text-lg">+{win.hive_won}</p>
                        <p className="text-hive-gold/60 text-[10px]">🍯 Hive Won</p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            {loading ? (
              <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-40 skeleton rounded-2xl" />)}</div>
            ) : giveaways.length === 0 ? (
              <div className="text-center py-16 text-white/30">
                <Gift size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No giveaways here</p>
                <p className="text-xs mt-1">Check back later!</p>
              </div>
            ) : (
              giveaways.map((g, index) => renderGiveawayCard(g, index))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
