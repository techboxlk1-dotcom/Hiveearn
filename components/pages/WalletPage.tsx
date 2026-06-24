'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wallet, ArrowDownRight, ArrowUpRight, Calculator, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import HiveBalance from '@/components/ui/HiveBalance';
import { setWallet, getWallet, requestWithdrawal, getUserWithdrawals } from '@/lib/api';
import type { Withdrawal } from '@/lib/supabase';
import { formatUsdt, hiveToUsdt, isValidBep20Address, timeAgo, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';

type View = 'main' | 'set-wallet' | 'withdraw';

export default function WalletPage() {
  const { user, refreshUser } = useUser();
  const [view, setView] = useState<View>('main');
  const [walletAddress, setWalletAddress] = useState('');
  const [savedWallet, setSavedWallet] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!user) return;
    getWallet(user.id).then(w => setSavedWallet(w?.address ?? null));
    getUserWithdrawals(user.id).then(setWithdrawals);
  }, [user]);

  if (!user) return null;

  const hiveAmount = parseFloat(withdrawAmount) || 0;
  const usdtAmount = hiveToUsdt(hiveAmount);
  const feeFixed = 0.01;
  const feePercent = usdtAmount * 0.05;
  const totalFee = feeFixed + feePercent;
  const netAmount = Math.max(0, usdtAmount - totalFee);
  const minWithdraw = 800; // 800 Hive = 0.08 USDT

  const handleSaveWallet = async () => {
    if (!user || saving) return;
    if (!isValidBep20Address(walletAddress)) { toast.error('Invalid BEP20 address (must start with 0x)'); return; }
    setSaving(true);
    const result = await setWallet(user.id, walletAddress);
    if (result.success) {
      setSavedWallet(walletAddress);
      toast.success('Wallet saved!');
      setView('main');
    } else {
      toast.error(result.message);
    }
    setSaving(false);
  };

  const handleWithdraw = async () => {
    if (!user || withdrawing || hiveAmount < minWithdraw) return;
    if (!savedWallet) { toast.error('Set a wallet address first'); setView('set-wallet'); return; }
    setWithdrawing(true);
    const result = await requestWithdrawal(user.id, hiveAmount);
    if (result.success) {
      toast.success(result.message, { icon: '✅' });
      setWithdrawAmount('');
      setView('main');
      await refreshUser();
      getUserWithdrawals(user.id).then(setWithdrawals);
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

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => view !== 'main' ? setView('main') : undefined}>
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
          <h1 className="text-white font-bold text-lg">
            {view === 'main' ? 'Wallet' : view === 'set-wallet' ? 'Set Wallet' : 'Withdraw'}
          </h1>
          <p className="text-white/40 text-xs">
            {view === 'main' ? 'Manage your funds' : view === 'set-wallet' ? 'BEP20 USDT address' : 'Request withdrawal'}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'main' && (
          <motion.div key="main" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
            {/* Balance */}
            <GlassCard gold glow className="p-5 text-center">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Balance</p>
              <HiveBalance amount={user.hive_balance} size="xl" />
            </GlassCard>

            {/* Wallet address */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Wallet size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">BEP20 Wallet</p>
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
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setView('withdraw')} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-red-900/30 to-transparent border border-red-500/15">
                <ArrowUpRight size={24} className="text-red-400" />
                <span className="text-white font-semibold text-sm">Withdraw</span>
                <span className="text-white/30 text-xs">Min 0.08 USDT</span>
              </motion.button>
              <Link href="/transactions">
                <motion.div whileTap={{ scale: 0.96 }} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-blue-900/30 to-transparent border border-blue-500/15 cursor-pointer">
                  <ArrowDownRight size={24} className="text-blue-400" />
                  <span className="text-white font-semibold text-sm">History</span>
                  <span className="text-white/30 text-xs">View all</span>
                </motion.div>
              </Link>
            </div>

            {/* Convert calc */}
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator size={14} className="text-hive-gold" />
                <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest">Converter</h3>
              </div>
              <p className="text-white/40 text-xs mb-1">Rate: 100 Hive = 0.01 USDT</p>
              <div className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-xl">
                <span className="text-hive-gold font-bold">{user.hive_balance.toLocaleString()} HIVE</span>
                <span className="text-white/30 text-sm">=</span>
                <span className="text-green-400 font-bold">{formatUsdt(hiveToUsdt(user.hive_balance))} USDT</span>
              </div>
            </GlassCard>

            {/* Recent withdrawals */}
            {withdrawals.length > 0 && (
              <div>
                <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">Withdrawal History</h3>
                <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
                  {withdrawals.slice(0, 5).map(wd => {
                    const cfg = statusConfig[wd.status] ?? statusConfig.pending;
                    return (
                      <div key={wd.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white/70 text-xs font-medium">{formatUsdt(wd.net_amount)} USDT</p>
                            <p className="text-white/30 text-[10px]">{truncateAddress(wd.wallet_address)} • {timeAgo(wd.created_at)}</p>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${cfg.bg}`}>
                            <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                          </div>
                        </div>
                        {wd.txid && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <p className="text-green-400/60 text-[10px] font-mono truncate">TXID: {wd.txid}</p>
                            <a href={`https://bscscan.com/tx/${wd.txid}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink size={10} className="text-green-400/60" />
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

        {view === 'set-wallet' && (
          <motion.div key="set-wallet" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <GlassCard className="p-5">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
                <AlertCircle size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-blue-300/80 text-xs">Only enter your BEP20 (BSC) USDT wallet address. Sending to wrong addresses will result in permanent loss.</p>
              </div>
              <label className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-2 block">BEP20 USDT Address</label>
              <input
                type="text"
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-hive-gold/40 transition-all mb-4"
              />
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

        {view === 'withdraw' && (
          <motion.div key="withdraw" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            {!savedWallet && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <AlertCircle size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-300/80 text-xs">Please set a wallet address first before withdrawing.</p>
              </div>
            )}
            <GlassCard className="p-5">
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
                  placeholder={`Min ${minWithdraw}`}
                  min={minWithdraw}
                  max={user.hive_balance}
                  className="flex-1 px-4 py-3 bg-white/[0.06] border border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-hive-gold/40 transition-all"
                />
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setWithdrawAmount(String(Math.floor(user.hive_balance)))} className="px-3 py-2 rounded-xl bg-hive-gold/10 border border-hive-gold/20 text-hive-gold text-xs font-bold">
                  MAX
                </motion.button>
              </div>

              {/* Fee breakdown */}
              {hiveAmount >= minWithdraw && (
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
                disabled={!savedWallet || hiveAmount < minWithdraw || hiveAmount > user.hive_balance || withdrawing}
                className="btn-hive w-full py-4 font-black rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {withdrawing ? 'Processing...' : hiveAmount < minWithdraw ? `Min ${minWithdraw} Hive (0.08 USDT)` : 'Request Withdrawal'}
              </motion.button>
              <p className="text-white/20 text-xs text-center mt-2">Withdrawals reviewed by admin within 24 hours</p>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
