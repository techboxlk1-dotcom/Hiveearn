'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Zap, CheckCircle, History } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { claimRewardCode } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { RewardCodeClaim, RewardCode } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';

interface ClaimWithCode extends RewardCodeClaim {
  reward_codes: RewardCode | null;
}

export default function RewardCodePage() {
  const { user, refreshUser } = useUser();
  const { showReward } = useRewardPopup();
  const [code, setCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(false);
  const [earned, setEarned] = useState(0);
  const [history, setHistory] = useState<ClaimWithCode[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('reward_code_claims')
      .select('*, reward_codes(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory((data as ClaimWithCode[]) ?? []));
  }, [user]);

  const handleClaim = async () => {
    if (!user || !code.trim() || claiming) return;
    setClaiming(true);
    try {
      const result = await claimRewardCode(user.id, code.trim());
      if (result.success) {
        setEarned(result.hive);
        setSuccess(true);
        setCode('');
        await refreshUser();
        toast.success(result.message, { icon: '🎁' });
        showReward(result.hive, 'Code Redeemed!', 'Reward code bonus', '⚡');
        setTimeout(() => setSuccess(false), 3000);
        // Refresh history
        const { data } = await supabase.from('reward_code_claims').select('*, reward_codes(*)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
        setHistory((data as ClaimWithCode[]) ?? []);
      } else {
        toast.error(result.message);
      }
    } finally {
      setClaiming(false);
    }
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
          <h1 className="text-white font-bold text-lg">Reward Code</h1>
          <p className="text-white/40 text-xs">Enter a code to earn Hive</p>
        </div>
      </div>

      {/* Claim form */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <GlassCard gold className="p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent pointer-events-none" />

          <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }} className="text-5xl text-center mb-4">
            🎁
          </motion.div>

          <h2 className="text-white font-black text-xl text-center mb-1">Enter Reward Code</h2>
          <p className="text-white/40 text-xs text-center mb-6">Get codes from our community channels</p>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="success" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="text-center py-6">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>
                  <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                </motion.div>
                <p className="text-green-400 font-black text-2xl">+{earned} Hive!</p>
                <p className="text-white/50 text-sm mt-1">Successfully claimed!</p>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="mb-4">
                  <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleClaim()}
                    placeholder="Enter code (e.g. HIVE2024)"
                    maxLength={32}
                    className="w-full px-4 py-4 bg-white/[0.06] border border-white/10 rounded-2xl text-white text-center font-mono text-lg tracking-widest placeholder:text-white/20 focus:outline-none focus:border-hive-gold/40 focus:bg-white/[0.08] transition-all"
                  />
                </div>
                <motion.button
                  onClick={handleClaim}
                  disabled={!code.trim() || claiming}
                  whileTap={{ scale: 0.96 }}
                  className="btn-hive w-full py-4 text-base font-black rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {claiming ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full" />
                      Claiming...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Zap size={18} /> Claim Reward
                    </span>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-white/20 text-xs text-center mt-4">Follow <span className="text-blue-400">@hiveearn</span> for codes</p>
        </GlassCard>
      </motion.div>

      {/* History */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-2 mb-3">
            <History size={14} className="text-white/40" />
            <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Claim History</h3>
          </div>
          <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
            {history.map(claim => (
              <div key={claim.id} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Zap size={14} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-mono font-medium">{claim.reward_codes?.code ?? 'CODE'}</p>
                    <p className="text-white/30 text-[10px]">{timeAgo(claim.created_at)}</p>
                  </div>
                </div>
                <span className="text-hive-gold font-bold text-sm">+{claim.hive_earned} H</span>
              </div>
            ))}
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
