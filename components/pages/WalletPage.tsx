'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownRight, Calculator, CheckCircle, AlertCircle, ExternalLink, DollarSign, Clock, Users, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import HiveBalance from '@/components/ui/HiveBalance';
import { setWallet, getWallet, requestWithdrawal, getUserWithdrawals, getWithdrawRequirements, isWithdrawUnlocked, unlockWithdraw, hasPendingWithdrawal } from '@/lib/api';
import type { Withdrawal } from '@/lib/supabase';
import type { WithdrawRequirementsResult } from '@/lib/api';
import { formatUsdt, hiveToUsdt, isValidBep20Address, timeAgo, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';
import { useAds } from '@/hooks/useAds';

type View = 'main' | 'set-wallet' | 'requirements' | 'withdraw-ads' | 'withdraw';

export default function WalletPage() {
  const { user, refreshUser } = useUser();
  const { showRewardAd } = useAds();
  const [view, setView] = useState<View>('main');
  const [walletAddress, setWalletAddress] = useState('');
  const [savedWallet, setSavedWallet] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [requirements, setRequirements] = useState<WithdrawRequirementsResult | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [adsWatched, setAdsWatched] = useState(0);
  const [watchingAd, setWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);

  useEffect(() => {
    if (!user) return;
    getWallet(user.id).then(w => setSavedWallet(w?.address ?? null));
    getUserWithdrawals(user.id).then(ws => setWithdrawals(ws as Withdrawal[]));
  }, [user]);

  if (!user) return null;

  const hiveAmount = parseFloat(withdrawAmount) || 0;
  const usdtAmount = hiveToUsdt(hiveAmount);
  const feeFixed = 0.01;
  const feePercent = usdtAmount * 0.05;
  const totalFee = feeFixed + feePercent;
  const netAmount = Math.max(0, usdtAmount - totalFee);
  const minWithdrawHive = requirements ? Math.ceil(requirements.minAmount / 0.0001) : 800;
  const maxWithdrawHive = requirements ? Math.floor(requirements.maxAmount / 0.0001) : 5000;

  const handleSaveWallet = async () => {
    if (!user || saving) return;
    if (!isValidBep20Address(walletAddress)) { toast.error('Invalid BEP20 address (must start with 0x)'); return; }
    setSaving(true);
    const result = await setWallet(user.id, walletAddress);
    if (result.success) { setSavedWallet(walletAddress); toast.success('Wallet saved!'); setView('main'); }
    else toast.error(result.message);
    setSaving(false);
  };

  const handleOpenWithdraw = async () => {
    if (!savedWallet) { setView('set-wallet'); return; }
    // Check if already unlocked today (UTC daily reset)
    const unlocked = await isWithdrawUnlocked(user.id);
    if (unlocked) {
      // Already unlocked today — skip requirements and ad gate, go straight to withdraw
      setReqLoading(true);
      const reqs = await getWithdrawRequirements(user.id);
      setRequirements(reqs);
      setReqLoading(false);
      setAdsWatched(2);
      setAdProgress(100);
      setView('withdraw');
      return;
    }
    // Check for pending withdrawal
    const hasPending = await hasPendingWithdrawal(user.id);
    if (hasPending) {
      toast.error('You have a pending withdrawal. Wait for it to be approved before requesting another.');
      return;
    }
    setReqLoading(true);
    const reqs = await getWithdrawRequirements(user.id);
    setRequirements(reqs);
    setReqLoading(false);
    setView('requirements');
  };

  const handleContinueToAds = () => {
    setAdsWatched(0);
    setAdProgress(0);
    setView('withdraw-ads');
  };

  const handleWatchWithdrawAd = useCallback(async () => {
    if (watchingAd || adsWatched >= 2) return;
    setWatchingAd(true);
    setAdProgress(((adsWatched) / 2) * 100);
    const result = await showRewardAd();
    if (result.success && result.clicked) {
      // Only count on success
      const newCount = adsWatched + 1;
      setAdsWatched(newCount);
      setAdProgress((newCount / 2) * 100);
      toast.success(`Ad ${newCount}/2 watched!`);
    } else {
      toast.error('Ad not completed. Please watch the full ad to continue.');
    }
    setWatchingAd(false);
  }, [watchingAd, adsWatched, showRewardAd]);

  const handleWithdraw = async () => {
    if (!user || withdrawing || hiveAmount < minWithdrawHive) return;
    if (!savedWallet) { toast.error('Set a wallet address first'); setView('set-wallet'); return; }
    setWithdrawing(true);
    const result = await requestWithdrawal(user.id, hiveAmount);
    if (result.success) {
      toast.success(result.message, { icon: '✅' });
      setWithdrawAmount('');
      setView('main');
      await refreshUser();
      getUserWithdrawals(user.id).then(ws => setWithdrawals(ws as Withdrawal[]));
    } else {
      toast.error(result.message);
    }
    setWithdrawing(false);
  };

  const statusConfig = {
    pending: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Pending' },
    approved: { color: 'text-green-400', bg: 'bg-green-400/10', label: 'Approved' },
    rejected: { color: 'text-red-400', bg: 'bg-red-400/10', label: 'Rejected' },
    processing: { color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Processing' },
  };

  const totalApproved = withdrawals.filter(w => w.status === 'approved').reduce((sum, w) => sum + w.net_amount, 0);
  const totalPending = withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + w.net_amount, 0);

  const headerTitle = view === 'main' ? 'Wallet' : view === 'set-wallet' ? 'Set Wallet' : view === 'requirements' ? 'Withdraw Requirements' : view === 'withdraw-ads' ? 'Watch Ads' : 'Withdraw';

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => view !== 'main' ? setView(view === 'withdraw' ? 'withdraw-ads' : view === 'withdraw-ads' ? 'requirements' : view === 'requirements' ? 'main' : 'main') : undefined}>
          {view !== 'main' ? (
            <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
              <ArrowLeft size={18} className="text-white/70" />
            </motion.div>
          ) : (
            <Link href="/">
              <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
                <ArrowLeft size={18} className="text-white/70" />
              </motion.div>
            </Link>
          )}
        </button>
        <div>
          <h1 className="text-white font-bold text-lg">{headerTitle}</h1>
          <p className="text-white/40 text-xs">{view === 'main' ? 'Manage your funds' : view === 'requirements' ? 'Complete to withdraw' : view === 'withdraw-ads' ? 'Watch 2 ads to continue' : view === 'withdraw' ? 'Request withdrawal' : 'BEP20 USDT address'}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Main View ── */}
        {view === 'main' && (
          <motion.div key="main" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
            <GlassCard gold glow className="p-5 text-center">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Hive Balance</p>
              <HiveBalance amount={user.hive_balance} size="xl" />
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-white/30 text-xs">≈</span>
                <span className="text-green-400 font-bold text-sm">{formatUsdt(hiveToUsdt(user.hive_balance))} USDT</span>
              </div>
            </GlassCard>

            {/* Wallet address */}
            <GlassCard className="p-4" animate={false}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Wallet size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white/40 text-xs">BEP20 Wallet</p>
                    <p className="text-white font-mono text-sm">{savedWallet ? truncateAddress(savedWallet) : 'Not set'}</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setWalletAddress(savedWallet ?? ''); setView('set-wallet'); }} className="px-3 py-1.5 rounded-xl bg-hive-gold/10 border border-hive-gold/20 text-hive-gold text-xs font-bold">
                  {savedWallet ? 'Edit' : 'Set'}
                </motion.button>
              </div>
            </GlassCard>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleOpenWithdraw} disabled={reqLoading} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-red-900/30 to-transparent border border-red-500/15 disabled:opacity-50">
                {reqLoading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-2 border-red-400/30 border-t-red-400 rounded-full" /> : <ArrowUpRight size={24} className="text-red-400" />}
                <span className="text-white font-semibold text-sm">Withdraw</span>
                <span className="text-white/30 text-xs">USDT BEP20</span>
              </motion.button>
              <Link href="/transactions">
                <motion.div whileTap={{ scale: 0.96 }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-blue-900/30 to-transparent border border-blue-500/15 cursor-pointer">
                  <ArrowDownRight size={24} className="text-blue-400" />
                  <span className="text-white font-semibold text-sm">History</span>
                  <span className="text-white/30 text-xs">All transactions</span>
                </motion.div>
              </Link>
            </div>

            {/* Stats */}
            {withdrawals.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <GlassCard className="p-3 text-center" animate={false}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-green-400 font-mono text-xs">$</span>
                    <p className="text-green-400 font-black text-lg">{formatUsdt(totalApproved)}</p>
                  </div>
                  <p className="text-white/30 text-[10px]">Total Paid Out</p>
                </GlassCard>
                <GlassCard className="p-3 text-center" animate={false}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-yellow-400 font-mono text-xs">$</span>
                    <p className="text-yellow-400 font-black text-lg">{formatUsdt(totalPending)}</p>
                  </div>
                  <p className="text-white/30 text-[10px]">Pending</p>
                </GlassCard>
              </div>
            )}

            {/* Converter */}
            <GlassCard className="p-4" animate={false}>
              <div className="flex items-center gap-2 mb-3">
                <Calculator size={14} className="text-hive-gold" />
                <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest">Converter</h3>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl">
                <span className="text-hive-gold font-bold">{user.hive_balance.toLocaleString()} HIVE</span>
                <span className="text-white/30 text-sm">=</span>
                <span className="text-green-400 font-bold">{formatUsdt(hiveToUsdt(user.hive_balance))} USDT</span>
              </div>
              <p className="text-white/20 text-[10px] mt-2">Rate: 100 Hive = $0.01 USDT</p>
            </GlassCard>

            {/* Withdrawal history */}
            {withdrawals.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Withdrawal History</h3>
                  <span className="text-white/20 text-xs">{withdrawals.length} total</span>
                </div>
                <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
                  {withdrawals.slice(0, 8).map(wd => {
                    const cfg = statusConfig[(wd as { status: keyof typeof statusConfig }).status] ?? statusConfig.pending;
                    return (
                      <div key={wd.id} className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-green-400 text-xs font-mono font-bold">$</span>
                              <span className="text-white/80 text-sm font-bold">{formatUsdt(wd.net_amount)} USDT</span>
                            </div>
                            <p className="text-white/20 text-[10px]">{(wd as { withdraw_id?: string }).withdraw_id ?? 'WD-??????'} • {timeAgo(wd.created_at)}</p>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${cfg.bg}`}>
                            <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-white/30 font-mono">{truncateAddress(wd.wallet_address)}</span>
                          <span className="text-white/20">{(wd as { hive_amount: number }).hive_amount?.toLocaleString() ?? 0} HIVE</span>
                        </div>
                        {(wd as { txid?: string }).txid && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <p className="text-green-400/60 text-[10px] font-mono truncate">TXID: {(wd as { txid: string }).txid}</p>
                            <a href={`https://bscscan.com/tx/${(wd as { txid: string }).txid}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink size={9} className="text-green-400/60" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </GlassCard>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Set Wallet ── */}
        {view === 'set-wallet' && (
          <motion.div key="set-wallet" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <GlassCard className="p-5" animate={false}>
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
                <AlertCircle size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-blue-300/80 text-xs">Only enter your BEP20 (BSC) USDT wallet address. Sending to wrong addresses will result in permanent loss.</p>
              </div>
              <label className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2 block">BEP20 USDT Address</label>
              <input type="text" value={walletAddress} onChange={e => setWalletAddress(e.target.value)} placeholder="0x..." className="w-full px-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-hive-gold/40 transition-all mb-4" />
              {walletAddress && (
                <div className={`flex items-center gap-2 mb-4 text-xs font-medium ${isValidBep20Address(walletAddress) ? 'text-green-400' : 'text-red-400'}`}>
                  {isValidBep20Address(walletAddress) ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                  {isValidBep20Address(walletAddress) ? 'Valid BEP20 address' : 'Invalid address format'}
                </div>
              )}
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleSaveWallet} disabled={!isValidBep20Address(walletAddress) || saving} className="btn-hive w-full py-4 font-black rounded-2xl disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Wallet'}
              </motion.button>
            </GlassCard>
          </motion.div>
        )}

        {/* ── Requirements ── */}
        {view === 'requirements' && requirements && (
          <motion.div key="requirements" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <GlassCard className="p-5" animate={false}>
              <h2 className="text-white font-black text-base mb-1">Withdraw Requirements</h2>
              <p className="text-white/40 text-xs mb-5">Complete all requirements to continue</p>

              <div className="space-y-3">
                {/* Daily Ads */}
                <RequirementRow
                  icon={<PlayCircle size={18} className={requirements.dailyAds.met ? 'text-green-400' : 'text-white/40'} />}
                  label="Daily Ads Watched"
                  current={requirements.dailyAds.current}
                  required={requirements.dailyAds.required}
                  met={requirements.dailyAds.met}
                  suffix="ads"
                  linkHref="/ads"
                  linkLabel="Watch Ads"
                />

                {/* Refers */}
                <RequirementRow
                  icon={<Users size={18} className={requirements.refers.met ? 'text-green-400' : 'text-white/40'} />}
                  label="Referrals"
                  current={requirements.refers.current}
                  required={requirements.refers.required}
                  met={requirements.refers.met}
                  suffix="referrals"
                  linkHref="/referral"
                  linkLabel="Refer Friends"
                />

                {/* Main Tasks */}
                {requirements.mainTasks.total > 0 && (
                  <RequirementRow
                    icon={<CheckCircle size={18} className={requirements.mainTasks.met ? 'text-green-400' : 'text-white/40'} />}
                    label="Main Tasks"
                    current={requirements.mainTasks.current}
                    required={requirements.mainTasks.total}
                    met={requirements.mainTasks.met}
                    suffix="tasks"
                    linkHref="/tasks"
                    linkLabel="Complete Tasks"
                  />
                )}

                {/* Minimum amount */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <div className="w-9 h-9 rounded-lg bg-hive-gold/10 flex items-center justify-center flex-shrink-0">
                    <DollarSign size={18} className="text-hive-gold" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white/70 text-sm font-semibold">Minimum Amount</p>
                    <p className="text-white/40 text-xs">${requirements.minAmount} USDT {requirements.withdrawCount === 0 ? '(first withdrawal)' : ''}</p>
                  </div>
                  <p className="text-white/40 text-xs">Max ${requirements.maxAmount}</p>
                </div>
              </div>
            </GlassCard>

            {requirements.allMet ? (
              <motion.button whileTap={{ scale: 0.96 }} onClick={handleContinueToAds} className="w-full py-4 btn-hive rounded-2xl font-black text-base flex items-center justify-center gap-2">
                Continue <ArrowUpRight size={20} />
              </motion.button>
            ) : (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-yellow-400 text-xs text-center font-semibold">Complete all requirements to unlock withdrawal</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Watch Ads before withdraw ── */}
        {view === 'withdraw-ads' && (
          <motion.div key="withdraw-ads" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-5">
            <GlassCard className="p-6" animate={false}>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center mx-auto mb-4">
                  <PlayCircle size={32} className="text-hive-gold" />
                </div>
                <h2 className="text-white font-black text-lg mb-1">Watch 2 Ads</h2>
                <p className="text-white/40 text-sm">Watch 2 ads to unlock your withdrawal</p>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-white/40 mb-2">
                  <span>{adsWatched} / 2 ads watched</span>
                  <span>{adsWatched >= 2 ? 'Complete!' : `${2 - adsWatched} remaining`}</span>
                </div>
                <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-hive-gold to-hive-amber"
                    animate={{ width: `${adProgress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>

                {/* Step indicators */}
                <div className="flex justify-around mt-3">
                  {[1, 2].map(step => (
                    <div key={step} className="flex flex-col items-center gap-1">
                      <motion.div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${adsWatched >= step ? 'bg-hive-gold text-black' : 'bg-white/[0.08] text-white/30'}`}
                        animate={adsWatched >= step ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ duration: 0.4 }}
                      >
                        {adsWatched >= step ? <CheckCircle size={14} /> : step}
                      </motion.div>
                      <span className="text-white/30 text-[10px]">Ad {step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {adsWatched < 2 ? (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleWatchWithdrawAd}
                  disabled={watchingAd}
                  className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' }}
                >
                  {watchingAd ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full" /> Opening Ad {adsWatched + 1}...</>
                  ) : adsWatched === 1 ? (
                    <><Clock size={20} /> Watch Ad 2 (5s countdown)</>
                  ) : (
                    <><PlayCircle size={20} /> Watch Ad {adsWatched + 1}</>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={async () => {
                    // Unlock withdraw for today (persists until daily reset at 00:00 UTC)
                    await unlockWithdraw(user.id);
                    setView('withdraw');
                  }}
                  className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <CheckCircle size={20} /> Continue to Withdraw
                </motion.button>
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* ── Withdraw Form ── */}
        {view === 'withdraw' && (
          <motion.div key="withdraw" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <GlassCard className="p-5" animate={false}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/40 text-xs">Available</p>
                  <p className="text-hive-gold font-black text-xl">{user.hive_balance.toLocaleString()} HIVE</p>
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-xs">Wallet</p>
                  <p className="text-white/60 font-mono text-xs">{savedWallet ? truncateAddress(savedWallet) : 'Not set'}</p>
                </div>
              </div>

              <label className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2 block">Hive Amount</label>
              <div className="flex gap-2 mb-4">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder={`Min ${minWithdrawHive} HIVE ($${requirements?.minAmount ?? 0.08} USDT)`}
                  min={minWithdrawHive}
                  max={Math.min(user.hive_balance, maxWithdrawHive)}
                  className="flex-1 px-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-hive-gold/40 transition-all"
                />
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setWithdrawAmount(String(Math.min(Math.floor(user.hive_balance), maxWithdrawHive)))} className="px-3 py-2 rounded-xl bg-hive-gold/10 border border-hive-gold/20 text-hive-gold text-xs font-bold">
                  MAX
                </motion.button>
              </div>

              {hiveAmount >= minWithdrawHive && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 p-3 bg-white/[0.04] rounded-xl space-y-2">
                  {[
                    { label: 'USDT Amount', value: `${formatUsdt(usdtAmount)} USDT`, color: 'text-white/70' },
                    { label: 'Fixed Fee', value: `-${formatUsdt(feeFixed)} USDT`, color: 'text-red-400' },
                    { label: 'Network Fee (5%)', value: `-${formatUsdt(feePercent)} USDT`, color: 'text-red-400' },
                    { label: 'You Receive', value: `${formatUsdt(netAmount)} USDT`, color: 'text-green-400', bold: true },
                  ].map(row => (
                    <div key={row.label} className={`flex justify-between text-xs ${row.bold ? 'border-t border-white/[0.06] pt-2' : ''}`}>
                      <span className="text-white/40">{row.label}</span>
                      <span className={`font-bold ${row.color}`}>{row.value}</span>
                    </div>
                  ))}
                </motion.div>
              )}

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleWithdraw}
                disabled={!savedWallet || hiveAmount < minWithdrawHive || hiveAmount > user.hive_balance || hiveAmount > maxWithdrawHive || withdrawing}
                className="btn-hive w-full py-4 font-black rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {withdrawing ? 'Processing...' : hiveAmount < minWithdrawHive ? `Min ${minWithdrawHive} HIVE ($${requirements?.minAmount ?? 0.08} USDT)` : 'Request Withdrawal'}
              </motion.button>
              <p className="text-white/20 text-xs text-center mt-2">Reviewed by admin within 24 hours</p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RequirementRow({
  icon, label, current, required, met, suffix, linkHref, linkLabel,
}: {
  icon: React.ReactNode;
  label: string;
  current: number;
  required: number;
  met: boolean;
  suffix: string;
  linkHref: string;
  linkLabel: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${met ? 'bg-green-500/5 border-green-500/20' : 'bg-white/[0.04] border-white/[0.06]'}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${met ? 'bg-green-500/15' : 'bg-white/[0.06]'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${met ? 'text-white' : 'text-white/60'}`}>{label}</p>
        <p className={`text-xs ${met ? 'text-green-400' : 'text-white/30'}`}>{current} / {required} {suffix}</p>
        {!met && (
          <div className="h-1 mt-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-hive-gold/40 rounded-full" style={{ width: `${Math.min(100, (current / required) * 100)}%` }} />
          </div>
        )}
      </div>
      {met ? (
        <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
      ) : (
        <Link href={linkHref} className="text-hive-gold text-[10px] font-bold flex-shrink-0">{linkLabel}</Link>
      )}
    </div>
  );
}
