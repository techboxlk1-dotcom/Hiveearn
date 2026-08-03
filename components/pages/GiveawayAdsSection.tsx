'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle, CheckCircle, Clock, AlertCircle, RefreshCw, XCircle, Shield, Baby, Info } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getBabyHiveAdProviders, getTodayAdCount, recordAdWatch, addBabyHive } from '@/lib/api';
import type { AdProvider } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';
import { useAds } from '@/hooks/useAds';

interface ProviderWithCount extends AdProvider {
  todayCount: number;
}

// ─── Centered Modal Wrapper ───────────────────────────────────────────────────
function CenteredModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Ad Closed Early popup ─────────────────────────────────────────────────────
function AdClosedEarlyModal({ onRetry, onLater }: { onRetry: () => void; onLater: () => void }) {
  return (
    <CenteredModal onClose={onLater}>
      <div className="p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <XCircle size={40} className="text-red-400" />
        </div>
        <h2 className="text-red-400 font-black text-xl mb-2">Ad Closed Too Early!</h2>
        <p className="text-white/40 text-sm mb-5">You must watch the ad for the full duration to earn Baby Hive.</p>
        <div className="p-4 mb-5 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-300/80 text-sm">
            The ad was closed before the timer finished. Keep the ad open for the entire duration to receive your reward.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={onRetry} className="py-3.5 rounded-xl font-bold text-sm" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
            <span className="flex items-center justify-center gap-2"><RefreshCw size={16} /> Try Again</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onLater} className="py-3.5 rounded-xl font-bold text-sm bg-white/[0.06] text-white/60">
            Later
          </motion.button>
        </div>
      </div>
    </CenteredModal>
  );
}

// ─── Ad error popup ────────────────────────────────────────────────────────────
function AdErrorModal({ message, onRetry, onLater }: { message: string; onRetry: () => void; onLater: () => void }) {
  return (
    <CenteredModal onClose={onLater}>
      <div className="p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={40} className="text-yellow-400" />
        </div>
        <h2 className="text-yellow-400 font-black text-xl mb-2">Ad Not Played!</h2>
        <p className="text-white/40 text-sm mb-5">No reward without watching an ad.</p>
        <div className="p-4 mb-5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-yellow-300/80 text-sm">{message}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.96 }} onClick={onRetry} className="py-3.5 rounded-xl font-bold text-sm" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
            <span className="flex items-center justify-center gap-2"><RefreshCw size={16} /> Try Again</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onLater} className="py-3.5 rounded-xl font-bold text-sm bg-white/[0.06] text-white/60">
            Later
          </motion.button>
        </div>
      </div>
    </CenteredModal>
  );
}

// ─── VPN popup (Adsgram AI ads not available) ──────────────────────────────────
function VpnModal({ onClose }: { onClose: () => void }) {
  return (
    <CenteredModal onClose={onClose}>
      <div className="p-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-5">
          <Shield size={40} className="text-blue-400" />
        </div>
        <h2 className="text-blue-400 font-black text-xl mb-2">Adsgram AI Ads Unavailable</h2>
        <p className="text-white/40 text-sm mb-5">Adsgram AI ads are not available in your region.</p>
        <div className="p-4 mb-5 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-blue-300/80 text-sm">
            Please use a <b>VPN</b> to change your location and try again. Adsgram AI ads are only available in certain regions.
          </p>
        </div>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onClose} className="w-full py-3.5 rounded-xl font-bold text-sm btn-hive">
          OK, Got it
        </motion.button>
      </div>
    </CenteredModal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function GiveawayAdsSection() {
  const { user, refreshUser } = useUser();
  const { showReward } = useRewardPopup();
  const { startAdWithTimer, getMinWatchTime } = useAds();

  const [providers, setProviders] = useState<ProviderWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState<string | null>(null);
  const [globalCooldown, setGlobalCooldown] = useState(0);
  const [showAdError, setShowAdError] = useState(false);
  const [showAdClosedEarly, setShowAdClosedEarly] = useState(false);
  const [showVpnPopup, setShowVpnPopup] = useState(false);
  const [adErrorMessage, setAdErrorMessage] = useState('Ad failed to play. Please try again.');
  const [lastWatchedProvider, setLastWatchedProvider] = useState<ProviderWithCount | null>(null);

  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Global 5-second cooldown on ALL buttons
  const startGlobalCooldown = useCallback(() => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setGlobalCooldown(5);
    let remaining = 5;
    cooldownTimerRef.current = setInterval(() => {
      remaining--;
      setGlobalCooldown(remaining);
      if (remaining <= 0) {
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        setGlobalCooldown(0);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const ps = await getBabyHiveAdProviders();
      const withCounts = await Promise.all(
        ps.map(async p => ({ ...p, todayCount: await getTodayAdCount(user.id, p.id) }))
      );
      setProviders(withCounts);
      setLoading(false);
    };
    load();
  }, [user]);

  const giveReward = useCallback((provider: ProviderWithCount) => {
    showReward(0, 'Ad Watched!', `+100 Baby Hive`, '📺');
    toast.success(`+100 🍼 Baby Hive!`, { icon: '🐝' });
    setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, todayCount: p.todayCount + 1 } : p));
    startGlobalCooldown();

    recordAdWatch(user!.id, provider.id, 0).then(res => {
      if (res.success) {
        addBabyHive(user!.id, 100);
        refreshUser();
      } else {
        toast.error(res.message);
        setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, todayCount: Math.max(0, p.todayCount - 1) } : p));
      }
    }).catch(() => {
      toast.error('Failed to record reward');
      setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, todayCount: Math.max(0, p.todayCount - 1) } : p));
    });
  }, [user, showReward, refreshUser, startGlobalCooldown]);

  const handleWatchAd = useCallback(async (provider: ProviderWithCount) => {
    if (!user || watching || globalCooldown > 0) return;
    if (provider.todayCount >= provider.daily_limit) {
      toast.error(`Daily limit reached for ${provider.name}`);
      return;
    }

    setWatching(provider.id);
    setLastWatchedProvider(provider);

    try {
      const result = await startAdWithTimer(provider);
      const minWatchSeconds = getMinWatchTime(provider);

      if (result.opened && result.watchTimeSeconds >= minWatchSeconds) {
        giveReward(provider);
      } else if (!result.opened && result.watchTimeSeconds === 0) {
        // Ad never opened — check if it's Adsgram AI to show VPN popup
        const slug = provider.slug ?? '';
        const blockId = provider.block_id ?? '';
        const isAdsgramAi = blockId === 'int-36139' || slug === 'adsgram-ai' || slug === 'adsgram';
        if (isAdsgramAi) {
          setShowVpnPopup(true);
        } else {
          setAdErrorMessage('Ad failed to play. Please try again.');
          setShowAdError(true);
        }
        startGlobalCooldown();
      } else {
        setShowAdClosedEarly(true);
        startGlobalCooldown();
      }
    } catch {
      setAdErrorMessage('Something went wrong. Please try again.');
      setShowAdError(true);
      startGlobalCooldown();
    } finally {
      setWatching(null);
    }
  }, [user, watching, globalCooldown, startAdWithTimer, giveReward, startGlobalCooldown, getMinWatchTime]);

  const providerIcon: Record<string, string> = { adsgram: '🎯', monetag: '💰', gigapub: '📢', monetix: '🎬', taddy: '🐻', towerads: '🗼' };
  const providerColor: Record<string, string> = { adsgram: 'text-blue-400', monetag: 'text-green-400', gigapub: 'text-yellow-400', monetix: 'text-purple-400', taddy: 'text-orange-400', towerads: 'text-cyan-400' };
  const providerBg: Record<string, string> = { adsgram: 'from-blue-900/30', monetag: 'from-green-900/30', gigapub: 'from-yellow-900/30', monetix: 'from-purple-900/30', taddy: 'from-orange-900/30', towerads: 'from-cyan-900/30' };

  const totalBabyHive = providers.reduce((sum, p) => sum + p.todayCount * 100, 0);
  const allAdsDone = providers.length > 0 && providers.every(p => p.todayCount >= p.daily_limit);

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl">
        <Info size={14} className="text-pink-400 mt-0.5 flex-shrink-0" />
        <p className="text-pink-300/80 text-xs">Watch ads from each network to earn <b>100 Baby Hive</b> per ad. Use Baby Hive to join giveaways and win Hive!</p>
      </div>

      {/* Summary card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard gold className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                <Baby size={20} className="text-pink-400" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Baby Hive Today</p>
                <p className="text-pink-400 font-black text-xl">{totalBabyHive} 🍼</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white/30 text-[10px]">Per Ad</p>
              <p className="text-hive-gold font-bold text-sm">+100 🍼</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {allAdsDone && !loading && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
          <CheckCircle size={16} className="text-green-400" />
          <p className="text-green-300/80 text-xs">All ads watched for today! Come back tomorrow.</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-36 skeleton rounded-2xl" />)}</div>
      ) : (
        providers.map((provider, index) => {
          const slug = provider.slug ?? '';
          const icon = providerIcon[slug] ?? '📺';
          const color = providerColor[slug] ?? 'text-white/60';
          const bg = providerBg[slug] ?? 'from-gray-900/30';
          const remaining = provider.daily_limit - provider.todayCount;
          const isComplete = remaining <= 0;
          const isWatching = watching === provider.id;
          const isCooling = globalCooldown > 0;
          const disabled = isComplete || isWatching || !!watching || isCooling;

          return (
            <motion.div key={provider.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
              <GlassCard className={isComplete ? 'opacity-70' : ''} animate={false}>
                <div className={`bg-gradient-to-r ${bg} to-transparent p-4 border-b border-white/[0.04]`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{icon}</span>
                      <div>
                        <h3 className="text-white font-bold">{provider.name}</h3>
                        <p className={`text-xs font-semibold ${color}`}>+100 Baby Hive per ad</p>
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
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-white/40 mb-1.5">
                      <span>{provider.todayCount} / {provider.daily_limit} ads</span>
                      <span>{remaining} left</span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-pink-500" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (provider.todayCount / provider.daily_limit) * 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                    </div>
                  </div>

                  <motion.button
                    onClick={() => handleWatchAd(provider)}
                    disabled={disabled}
                    whileTap={{ scale: disabled ? 1 : 0.96 }}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    style={!isComplete && !isCooling ? { background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                  >
                    {isWatching ? (
                      <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full" /> Ad Playing...</>
                    ) : isCooling ? (
                      <><Clock size={14} /> Ready in {globalCooldown}s</>
                    ) : isComplete ? (
                      <><CheckCircle size={16} /> Completed</>
                    ) : (
                      <><PlayCircle size={16} /> Watch Ad — +100 🍼</>
                    )}
                  </motion.button>
                </div>
              </GlassCard>
            </motion.div>
          );
        })
      )}

      {/* Ad closed early popup */}
      <AnimatePresence>
        {showAdClosedEarly && lastWatchedProvider && (
          <AdClosedEarlyModal
            onRetry={() => { setShowAdClosedEarly(false); handleWatchAd(lastWatchedProvider); }}
            onLater={() => setShowAdClosedEarly(false)}
          />
        )}
      </AnimatePresence>

      {/* Ad error popup */}
      <AnimatePresence>
        {showAdError && lastWatchedProvider && (
          <AdErrorModal
            message={adErrorMessage}
            onRetry={() => { setShowAdError(false); handleWatchAd(lastWatchedProvider); }}
            onLater={() => setShowAdError(false)}
          />
        )}
      </AnimatePresence>

      {/* VPN popup */}
      <AnimatePresence>
        {showVpnPopup && (
          <VpnModal onClose={() => setShowVpnPopup(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
