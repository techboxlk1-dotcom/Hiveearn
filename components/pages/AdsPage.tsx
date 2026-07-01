'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, PlayCircle, CheckCircle, Globe, MousePointer, Clock, ExternalLink, AlertCircle, Timer } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getAdProviders, getTodayAdCount, recordAdWatch, getVisitWebsites, getTodayWebsiteVisits, recordWebsiteVisit } from '@/lib/api';
import type { AdProvider } from '@/lib/supabase';
import type { VisitWebsite } from '@/lib/api';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';
import { useAds } from '@/hooks/useAds';

type AdsTab = 'watch' | 'visit';

interface ProviderWithCount extends AdProvider {
  todayCount: number;
}

// Ad error popup — shown when ad didn't play
function AdErrorModal({ message, onRetry, onLater }: { message: string; onRetry: () => void; onLater: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onLater}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-400 font-black text-lg leading-tight">Ad Not Played!</p>
              <p className="text-white/40 text-xs uppercase tracking-widest">No Reward Without Ad</p>
            </div>
          </div>

          <div className="p-3 mb-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-400/80 text-xs">{message}<br /><span className="text-white/40">You must watch the ad to earn a reward.</span></p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <motion.button whileTap={{ scale: 0.96 }} onClick={onRetry} className="py-3 rounded-2xl font-bold text-sm" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
              <span className="flex items-center justify-center gap-2"><PlayCircle size={16} /> Try Again</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={onLater} className="py-3 rounded-2xl font-bold text-sm bg-white/[0.06] text-white/60">
              Later
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Ad watching progress modal with countdown — ad must stay open
function AdWatchingModal({ seconds, providerName, onComplete, onCancel }: { seconds: number; providerName: string; onComplete: () => void; onCancel: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!cancelledRef.current) onComplete();
      return;
    }
    const timer = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onComplete]);

  const progress = ((seconds - remaining) / seconds) * 100;

  const handleCancel = () => {
    cancelledRef.current = true;
    onCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden text-center p-6"
        style={{ background: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="w-20 h-20 rounded-2xl bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center mx-auto mb-4">
          <Timer size={36} className="text-hive-gold" />
        </div>

        <h3 className="text-white font-black text-lg mb-1">{providerName}</h3>
        <p className="text-white/40 text-xs mb-6">Please wait while ad plays...</p>

        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="45" fill="none" stroke="#F5C518" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.83} 283`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-hive-gold font-black text-4xl">{remaining}</span>
          </div>
        </div>

        <p className="text-white/30 text-xs mb-4">Do not close this window</p>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleCancel}
          className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-bold"
        >
          Cancel
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// Visit website countdown modal
function VisitCountdownModal({ seconds, siteName, onComplete, onCancel }: { seconds: number; siteName: string; onComplete: () => void; onCancel: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onComplete]);

  const progress = ((seconds - remaining) / seconds) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden text-center p-6"
        style={{ background: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
          <Globe size={36} className="text-blue-400" />
        </div>

        <h3 className="text-white font-black text-lg mb-1">Visiting: {siteName}</h3>
        <p className="text-white/40 text-xs mb-6">Stay on the website to earn reward</p>

        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${progress * 2.83} 283`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-blue-400 font-black text-4xl">{remaining}</span>
          </div>
        </div>

        <p className="text-white/30 text-xs">Complete the countdown to earn +5 Hive</p>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCancel}
          className="mt-4 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-bold"
        >
          Cancel Visit
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// Visit incomplete popup — 15 seconds required
function VisitIncompleteModal({ onTryAgain, onLater }: { onTryAgain: () => void; onLater: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onLater}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <Clock size={28} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-400 font-black text-lg leading-tight">Time Not Completed!</p>
              <p className="text-white/40 text-xs uppercase tracking-widest">15 Seconds Required</p>
            </div>
          </div>

          <div className="p-3 mb-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-400/80 text-xs">You must stay on the website for at least 15 seconds.<br /><span className="text-white/40">Closing early = no reward.</span></p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <motion.button whileTap={{ scale: 0.96 }} onClick={onTryAgain} className="py-3 rounded-2xl font-bold text-sm" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff' }}>
              <span className="flex items-center justify-center gap-2"><Globe size={16} /> Try Again</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={onLater} className="py-3 rounded-2xl font-bold text-sm bg-white/[0.06] text-white/60">
              Later
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function AdsPage() {
  const { user, refreshUser } = useUser();
  const { showReward } = useRewardPopup();
  const { showRewardAd, showMonetag, showGigapub, showRandomAd, adsgramReady } = useAds();

  const [activeTab, setActiveTab] = useState<AdsTab>('watch');
  const [providers, setProviders] = useState<ProviderWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const [showNotClicked, setShowNotClicked] = useState(false);
  const [showAdError, setShowAdError] = useState(false);
  const [adErrorMessage, setAdErrorMessage] = useState('Ad failed to play. Please try again.');
  const [lastWatchedProvider, setLastWatchedProvider] = useState<ProviderWithCount | null>(null);

  // Ad watching progress modal state
  const [showAdProgress, setShowAdProgress] = useState(false);
  const [adProgressSeconds, setAdProgressSeconds] = useState(0);
  const [adProgressProvider, setAdProgressProvider] = useState<ProviderWithCount | null>(null);
  const adProgressResolveRef = useRef<((completed: boolean) => void) | null>(null);

  // Visit websites state
  const [websites, setWebsites] = useState<VisitWebsite[]>([]);
  const [visitedToday, setVisitedToday] = useState<string[]>([]);
  const [visiting, setVisiting] = useState<string | null>(null);
  const [currentVisitingSite, setCurrentVisitingSite] = useState<VisitWebsite | null>(null);
  const [showVisitCountdown, setShowVisitCountdown] = useState(false);
  const [visitIncomplete, setVisitIncomplete] = useState(false);

  const countdownRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [ps, wbs, visited] = await Promise.all([
        getAdProviders(),
        getVisitWebsites(),
        getTodayWebsiteVisits(user.id),
      ]);
      const withCounts = await Promise.all(
        ps.map(async p => ({ ...p, todayCount: await getTodayAdCount(user.id, p.id) }))
      );
      setProviders(withCounts);
      setWebsites(wbs);
      setVisitedToday(visited);
      setLoading(false);
    };
    load();
  }, [user]);

  const startCountdown = useCallback((id: string, seconds: number, onDone?: () => void) => {
    if (countdownRefs.current[id]) clearInterval(countdownRefs.current[id]);
    setCountdowns(prev => ({ ...prev, [id]: seconds }));
    let remaining = seconds;
    countdownRefs.current[id] = setInterval(() => {
      remaining--;
      setCountdowns(prev => ({ ...prev, [id]: remaining }));
      if (remaining <= 0) {
        clearInterval(countdownRefs.current[id]);
        setCountdowns(prev => { const n = { ...prev }; delete n[id]; return n; });
        onDone?.();
      }
    }, 1000);
  }, []);

  // Show ad progress modal — resolves true if completed, false if cancelled
  const showAdProgressModal = useCallback((seconds: number, provider: ProviderWithCount): Promise<boolean> => {
    return new Promise((resolve) => {
      setAdProgressSeconds(seconds);
      setAdProgressProvider(provider);
      setShowAdProgress(true);
      adProgressResolveRef.current = resolve;
    });
  }, []);

  const handleAdProgressComplete = useCallback(() => {
    setShowAdProgress(false);
    setAdProgressProvider(null);
    if (adProgressResolveRef.current) {
      adProgressResolveRef.current(true);
      adProgressResolveRef.current = null;
    }
  }, []);

  const handleAdProgressCancel = useCallback(() => {
    setShowAdProgress(false);
    setAdProgressProvider(null);
    if (adProgressResolveRef.current) {
      adProgressResolveRef.current(false);
      adProgressResolveRef.current = null;
    }
  }, []);

  // Record successful ad watch and reward
  const rewardAdWatch = useCallback(async (provider: ProviderWithCount) => {
    const res = await recordAdWatch(user!.id, provider.id, provider.reward_per_ad);
    if (res.success) {
      showReward(provider.reward_per_ad, 'Ad Watched!', `+${provider.reward_per_ad} Hive earned`, '📺');
      toast.success(`+${provider.reward_per_ad} Hive earned!`, { icon: '🐝' });
      setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, todayCount: p.todayCount + 1 } : p));
      await refreshUser();
    } else {
      toast.error(res.message);
    }
    startCountdown(provider.id, 5);
  }, [user, showReward, refreshUser, startCountdown]);

  const handleWatchAd = useCallback(async (provider: ProviderWithCount) => {
    if (!user || watching || countdowns[provider.id] !== undefined) return;
    if (provider.todayCount >= provider.daily_limit) {
      toast.error(`Daily limit reached for ${provider.name}`);
      return;
    }

    setWatching(provider.id);
    setLastWatchedProvider(provider);

    const minWatchSeconds = provider.min_watch_seconds || 5;

    try {
      let adPlayed = false;

      // Adsgram rewarded (block 36138) — requires click verification
      if (provider.block_id === '36138') {
        const result = await showRewardAd();
        if (result.success && result.clicked) {
          adPlayed = true;
          const completed = await showAdProgressModal(minWatchSeconds, provider);
          if (completed) {
            await rewardAdWatch(provider);
          } else {
            // User cancelled the countdown — no reward
            setAdErrorMessage('You cancelled the ad before it finished. No reward given.');
            setShowAdError(true);
            startCountdown(provider.id, 5);
          }
        } else if (result.watched && !result.clicked) {
          // Ad watched but not clicked — no reward
          setShowNotClicked(true);
          startCountdown(provider.id, 5);
        } else {
          // Ad didn't play at all — error popup
          setAdErrorMessage('Ad failed to play. Please try again.');
          setShowAdError(true);
          startCountdown(provider.id, 5);
        }
      }
      // Adsgram interstitial (int-36139) or adsgram slug
      else if (provider.block_id === 'int-36139' || (provider.network_type === 'adsgram' && provider.slug === 'adsgram')) {
        if (adsgramReady()) {
          try {
            const controller = window.Adsgram!.init({ blockId: 'int-36139' });
            await controller.show();
            adPlayed = true;
          } catch { /* ad failed */ }
        }

        if (adPlayed) {
          const completed = await showAdProgressModal(minWatchSeconds, provider);
          if (completed) {
            await rewardAdWatch(provider);
          } else {
            setAdErrorMessage('You cancelled the ad before it finished. No reward given.');
            setShowAdError(true);
            startCountdown(provider.id, 5);
          }
        } else {
          setAdErrorMessage('Ad failed to play. Please try again.');
          setShowAdError(true);
          startCountdown(provider.id, 5);
        }
      }
      // Monetag — minimum 5 seconds watch required
      else if (provider.network_type === 'monetag' || provider.slug === 'monetag') {
        const { opened } = await showMonetag();
        if (opened) {
          adPlayed = true;
          const completed = await showAdProgressModal(Math.max(minWatchSeconds, 5), provider);
          if (completed) {
            await rewardAdWatch(provider);
          } else {
            setAdErrorMessage('You cancelled the ad before it finished. No reward given.');
            setShowAdError(true);
            startCountdown(provider.id, 5);
          }
        } else {
          setAdErrorMessage('Monetag ad failed to play. Please try again.');
          setShowAdError(true);
          startCountdown(provider.id, 5);
        }
      }
      // Gigapub — timer based with verification
      else if (provider.network_type === 'gigapub' || provider.slug === 'gigapub') {
        const { success } = await showGigapub();
        if (success) {
          adPlayed = true;
          const completed = await showAdProgressModal(minWatchSeconds, provider);
          if (completed) {
            await rewardAdWatch(provider);
          } else {
            setAdErrorMessage('You cancelled the ad before it finished. No reward given.');
            setShowAdError(true);
            startCountdown(provider.id, 5);
          }
        } else {
          setAdErrorMessage('Gigapub ad failed to play. Please try again.');
          setShowAdError(true);
          startCountdown(provider.id, 5);
        }
      } else {
        setAdErrorMessage('Ad provider not configured properly.');
        setShowAdError(true);
        startCountdown(provider.id, 5);
      }
    } catch {
      setAdErrorMessage('Something went wrong. Please try again.');
      setShowAdError(true);
      startCountdown(provider.id, 5);
    } finally {
      setWatching(null);
    }
  }, [user, watching, countdowns, showRewardAd, showMonetag, showGigapub, adsgramReady, showAdProgressModal, rewardAdWatch, startCountdown]);

  // Visit website handler — opens site, shows countdown, stops if cancelled
  const handleVisitWebsite = useCallback(async (website: VisitWebsite) => {
    if (!user || visiting || visitedToday.includes(website.id)) return;

    setVisiting(website.id);
    setCurrentVisitingSite(website);

    // Open website in new tab
    window.open(website.url, '_blank');

    // Show countdown modal
    setShowVisitCountdown(true);
  }, [user, visiting, visitedToday]);

  const handleVisitCountdownComplete = useCallback(async () => {
    setShowVisitCountdown(false);
    if (!user || !currentVisitingSite) return;

    const res = await recordWebsiteVisit(user.id, currentVisitingSite.id, currentVisitingSite.reward_hive);
    if (res.success) {
      showReward(currentVisitingSite.reward_hive, 'Visit Reward!', `+${currentVisitingSite.reward_hive} Hive earned`, '🌐');
      toast.success(`+${currentVisitingSite.reward_hive} Hive earned!`, { icon: '🌐' });
      setVisitedToday(prev => [...prev, currentVisitingSite.id]);
      await refreshUser();
    } else {
      toast.error(res.message);
    }
    setVisiting(null);
    setCurrentVisitingSite(null);
  }, [user, currentVisitingSite, showReward, refreshUser]);

  const handleVisitCountdownCancel = useCallback(() => {
    setShowVisitCountdown(false);
    setVisiting(null);
    // Keep currentVisitingSite so the incomplete modal can use it for "Try Again"
    setVisitIncomplete(true);
  }, []);

  const providerIcon: Record<string, string> = { adsgram: '🎯', monetag: '💰', gigapub: '📢' };
  const providerColor: Record<string, string> = { adsgram: 'text-blue-400', monetag: 'text-green-400', gigapub: 'text-yellow-400' };
  const providerBg: Record<string, string> = { adsgram: 'from-blue-900/30', monetag: 'from-green-900/30', gigapub: 'from-yellow-900/30' };

  const totalTodayEarnings = providers.reduce((sum, p) => sum + p.todayCount * p.reward_per_ad, 0);
  const totalAvailable = providers.reduce((sum, p) => sum + Math.max(0, p.daily_limit - p.todayCount) * p.reward_per_ad, 0);

  // Countdown for when all ads are done — show next available time
  const allAdsDone = providers.length > 0 && providers.every(p => p.todayCount >= p.daily_limit);

  return (
    <div className="min-h-dvh px-4 pt-4 pb-24">
      <div className="flex items-center gap-3 mb-5">
        <Link href="/">
          <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/70" />
          </motion.div>
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">Earn</h1>
          <p className="text-white/40 text-xs">Watch ads & visit websites</p>
        </div>
      </div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <GlassCard gold className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Today Earned</p>
              <p className="text-hive-gold font-black text-2xl">{totalTodayEarnings} HIVE</p>
            </div>
            <div className="text-right">
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Available</p>
              <p className="text-green-400 font-bold text-lg">{totalAvailable} HIVE</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* All ads done message */}
      {allAdsDone && activeTab === 'watch' && !loading && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2">
          <CheckCircle size={16} className="text-green-400" />
          <p className="text-green-300/80 text-xs">All ads watched for today! Come back tomorrow after daily reset (00:00 UTC).</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5 p-1 bg-white/[0.04] rounded-2xl">
        {([['watch', '📺 Watch Ads'], ['visit', '🌐 Visit Sites']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className="relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all">
            {activeTab === tab && <motion.div layoutId="ads-tab" className="absolute inset-0 btn-hive rounded-xl" />}
            <span className={`relative z-10 ${activeTab === tab ? 'text-black' : 'text-white/50'}`}>{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'watch' && (
          <motion.div key="watch" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
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
                const countdown = countdowns[provider.id];
                const hasCountdown = countdown !== undefined && countdown > 0;

                return (
                  <motion.div key={provider.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
                    <GlassCard className={isComplete ? 'opacity-70' : ''} animate={false}>
                      <div className={`bg-gradient-to-r ${bg} to-transparent p-4 border-b border-white/[0.04]`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{icon}</span>
                            <div>
                              <h3 className="text-white font-bold">{provider.name}</h3>
                              <p className={`text-xs font-semibold ${color}`}>+{provider.reward_per_ad} Hive per ad</p>
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
                            <motion.div className="h-full rounded-full bg-gradient-to-r from-hive-gold to-hive-amber" initial={{ width: 0 }} animate={{ width: `${Math.min(100, (provider.todayCount / provider.daily_limit) * 100)}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                          </div>
                        </div>

                        <motion.button
                          onClick={() => handleWatchAd(provider)}
                          disabled={isComplete || isWatching || !!watching || hasCountdown}
                          whileTap={{ scale: 0.96 }}
                          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          style={!isComplete && !hasCountdown ? { background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                        >
                          {isWatching ? (
                            <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full" /> Opening Ad...</>
                          ) : hasCountdown ? (
                            <><Clock size={14} /> Ready in {countdown}s</>
                          ) : isComplete ? (
                            <><CheckCircle size={16} /> Completed</>
                          ) : (
                            <><PlayCircle size={16} /> Watch Ad — +{provider.reward_per_ad}H</>
                          )}
                        </motion.button>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}

        {activeTab === 'visit' && (
          <motion.div key="visit" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-2">
              <Globe size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-blue-300/80 text-xs">Visit each website and stay for at least 15 seconds to earn 5 Hive. Each website can be visited once per day.</p>
            </div>

            {websites.length === 0 ? (
              <div className="text-center py-12 text-white/30">
                <Globe size={40} className="mx-auto mb-3 opacity-30" />
                <p>No websites available</p>
              </div>
            ) : (
              websites.map((site, index) => {
                const visited = visitedToday.includes(site.id);

                return (
                  <motion.div key={site.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
                    <GlassCard className={visited ? 'opacity-60' : ''} animate={false}>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                              <Globe size={20} className="text-blue-400" />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">{site.title || `Website ${index + 1}`}</p>
                              <p className="text-green-400 text-xs font-bold">+{site.reward_hive} Hive</p>
                            </div>
                          </div>
                          {visited && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/15 rounded-full">
                              <CheckCircle size={11} className="text-green-400" />
                              <span className="text-green-400 text-[10px] font-bold">Done</span>
                            </div>
                          )}
                        </div>

                        <motion.button
                          onClick={() => handleVisitWebsite(site)}
                          disabled={visited || !!visiting}
                          whileTap={{ scale: 0.96 }}
                          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={!visited ? { background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
                        >
                          {visited ? (
                            <><CheckCircle size={16} /> Visited Today</>
                          ) : visiting === site.id ? (
                            <><Clock size={14} className="animate-pulse" /> Visiting...</>
                          ) : (
                            <><ExternalLink size={16} /> Visit Website</>
                          )}
                        </motion.button>
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ad Not Clicked popup */}
      <AnimatePresence>
        {showNotClicked && lastWatchedProvider && (
          <AdNotClickedModal
            onWatchAgain={() => { setShowNotClicked(false); handleWatchAd(lastWatchedProvider); }}
            onLater={() => setShowNotClicked(false)}
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

      {/* Ad watching progress modal */}
      <AnimatePresence>
        {showAdProgress && adProgressProvider && (
          <AdWatchingModal
            seconds={adProgressSeconds}
            providerName={adProgressProvider.name}
            onComplete={handleAdProgressComplete}
            onCancel={handleAdProgressCancel}
          />
        )}
      </AnimatePresence>

      {/* Visit countdown modal */}
      <AnimatePresence>
        {showVisitCountdown && currentVisitingSite && (
          <VisitCountdownModal
            seconds={currentVisitingSite.min_watch_seconds || 15}
            siteName={currentVisitingSite.title || 'Website'}
            onComplete={handleVisitCountdownComplete}
            onCancel={handleVisitCountdownCancel}
          />
        )}
      </AnimatePresence>

      {/* Visit incomplete popup */}
      <AnimatePresence>
        {visitIncomplete && currentVisitingSite && (
          <VisitIncompleteModal
            onTryAgain={() => { setVisitIncomplete(false); handleVisitWebsite(currentVisitingSite); }}
            onLater={() => { setVisitIncomplete(false); setCurrentVisitingSite(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Ad Not Clicked modal — kept at bottom for reference
function AdNotClickedModal({ onWatchAgain, onLater }: { onWatchAgain: () => void; onLater: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onLater}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <MousePointer size={28} className="text-yellow-400" />
            </div>
            <div>
              <p className="text-red-400 font-black text-lg leading-tight">Ad Not Clicked!</p>
              <p className="text-white/40 text-xs uppercase tracking-widest">Click Required to Earn</p>
            </div>
          </div>

          <div className="p-3 mb-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-red-400/80 text-xs">Tap the advertiser&apos;s button to earn<br /><span className="text-white/40">Full ad watch + CTA click = reward. Skipping = no payout.</span></p>
          </div>

          <div className="space-y-2.5 mb-5">
            {[
              { icon: '👁', text: 'Watch the full ad' },
              { icon: '⚡', text: "Tap advertiser's button" },
              { icon: '🍯', text: 'Come back & claim reward' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-base">{icon}</div>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <motion.button whileTap={{ scale: 0.96 }} onClick={onWatchAgain} className="py-3 rounded-2xl font-bold text-sm" style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}>
              <span className="flex items-center justify-center gap-2"><PlayCircle size={16} /> Watch Again</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={onLater} className="py-3 rounded-2xl font-bold text-sm bg-white/[0.06] text-white/60">
              Later
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
