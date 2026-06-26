'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, PlayCircle, CheckCircle, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getAdProviders, getTodayAdCount, recordAdWatch } from '@/lib/api';
import type { AdProvider } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';

const providerMeta: Record<string, { color: string; bg: string; icon: string; url: string }> = {
  adsgram: { color: 'text-blue-400', bg: 'from-blue-900/40', icon: '🎯', url: 'https://t.me/AdsGram' },
  monetag: { color: 'text-green-400', bg: 'from-green-900/40', icon: '💰', url: 'https://monetag.com' },
  gigapub: { color: 'text-purple-400', bg: 'from-purple-900/40', icon: '📢', url: 'https://gigapub.net' },
};

interface ProviderWithCount extends AdProvider {
  todayCount: number;
}

export default function AdsPage() {
  const { user, refreshUser } = useUser();
  const { showReward } = useRewardPopup();
  const [providers, setProviders] = useState<ProviderWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState<string | null>(null);
  const [pendingVerify, setPendingVerify] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const ps = await getAdProviders();
      const withCounts = await Promise.all(
        ps.map(async p => ({ ...p, todayCount: await getTodayAdCount(user.id, p.id) }))
      );
      setProviders(withCounts);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleWatchAd = async (provider: ProviderWithCount) => {
    if (!user || watching) return;
    if (provider.todayCount >= provider.daily_limit) {
      toast.error(`Daily limit reached for ${provider.name}`);
      return;
    }

    setWatching(provider.id);
    // Open ad URL
    const meta = providerMeta[provider.slug] ?? { url: '#' };
    window.open(meta.url, '_blank');

    // Show verify button after 5 seconds (simulate ad completion)
    setTimeout(() => {
      setPendingVerify(provider.id);
      setWatching(null);
    }, 5000);
  };

  const handleVerify = async (provider: ProviderWithCount) => {
    if (!user) return;
    const result = await recordAdWatch(user.id, provider.id, provider.reward_per_ad);
    if (result.success) {
      toast.success(result.message, { icon: '🎉' });
      showReward(provider.reward_per_ad, 'Ad Watched!', `From ${provider.name}`, '📺');
      setPendingVerify(null);
      await refreshUser();
      setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, todayCount: p.todayCount + 1 } : p));
    } else {
      toast.error(result.message);
      setPendingVerify(null);
    }
  };

  const totalTodayEarnings = providers.reduce((sum, p) => sum + p.todayCount * p.reward_per_ad, 0);
  const totalAvailable = providers.reduce((sum, p) => sum + (p.daily_limit - p.todayCount) * p.reward_per_ad, 0);

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/70" />
          </motion.div>
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">Watch Ads</h1>
          <p className="text-white/40 text-xs">Earn Hive by watching ads</p>
        </div>
      </div>

      {/* Today stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <GlassCard gold className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Today Earned</p>
              <p className="text-hive-gold font-black text-2xl">{totalTodayEarnings} HIVE</p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Available</p>
              <p className="text-green-400 font-bold text-lg">{totalAvailable} HIVE</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Info */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-4">
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-blue-300/80 text-xs">Watch ads to earn Hive. Limits reset daily at midnight. After clicking Watch, the ad opens in a new tab. Return and click Verify to claim your reward.</p>
        </div>
      </motion.div>

      {/* Providers */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-36 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {providers.map((provider, index) => {
            const meta = providerMeta[provider.slug] ?? { color: 'text-white', bg: 'from-gray-900/40', icon: '📺', url: '#' };
            const remaining = provider.daily_limit - provider.todayCount;
            const isComplete = remaining <= 0;
            const isWatching = watching === provider.id;
            const isPendingVerify = pendingVerify === provider.id;

            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <GlassCard className={`overflow-hidden ${isComplete ? 'opacity-75' : ''}`} animate={false}>
                  <div className={`bg-gradient-to-r ${meta.bg} to-transparent p-4 border-b border-white/[0.04]`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{meta.icon}</span>
                        <div>
                          <h3 className="text-white font-bold">{provider.name}</h3>
                          <p className={`text-xs font-semibold ${meta.color}`}>+{provider.reward_per_ad} Hive per ad</p>
                        </div>
                      </div>
                      {isComplete && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-500/15 rounded-full">
                          <CheckCircle size={12} className="text-green-400" />
                          <span className="text-green-400 text-xs font-bold">Done</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-white/40 mb-1.5">
                        <span>{provider.todayCount} / {provider.daily_limit} ads watched</span>
                        <span>{remaining} remaining</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-hive-gold to-hive-amber"
                          initial={{ width: 0 }}
                          animate={{ width: `${(provider.todayCount / provider.daily_limit) * 100}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {isPendingVerify ? (
                        <motion.button
                          onClick={() => handleVerify(provider)}
                          whileTap={{ scale: 0.96 }}
                          className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold text-sm flex items-center justify-center gap-2"
                          animate={{ scale: [1, 1.02, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        >
                          <CheckCircle size={16} /> Verify & Claim +{provider.reward_per_ad} H
                        </motion.button>
                      ) : (
                        <motion.button
                          onClick={() => handleWatchAd(provider)}
                          disabled={isComplete || isWatching || !!watching}
                          whileTap={{ scale: 0.96 }}
                          className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={!isComplete ? { background: 'linear-gradient(135deg, #F5C518, #FFB300)', color: '#0A0A0A' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                        >
                          {isWatching ? (
                            <>
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full" />
                              Opening...
                            </>
                          ) : isComplete ? (
                            <><CheckCircle size={16} /> Completed</>
                          ) : (
                            <><PlayCircle size={16} /> Watch Ad</>
                          )}
                        </motion.button>
                      )}
                      <a href={meta.url} target="_blank" rel="noopener noreferrer">
                        <motion.div whileTap={{ scale: 0.9 }} className="w-11 h-11 rounded-xl glass-card flex items-center justify-center">
                          <ExternalLink size={16} className="text-white/40" />
                        </motion.div>
                      </a>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
