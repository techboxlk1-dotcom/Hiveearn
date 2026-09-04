'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, RefreshCw, Users, CreditCard, AlertCircle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { checkRequiredChannelMembership, REQUIRED_CHANNELS } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface ChannelGateProps {
  children: React.ReactNode;
}

export default function ChannelGate({ children }: ChannelGateProps) {
  const { user } = useUser();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ community: boolean; payments: boolean } | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user has previously verified channels
  useEffect(() => {
    if (!user) return;
    // Skip gate for admins/managers
    if (user.is_admin || user.is_manager) {
      setVerified(true);
      setLoading(false);
      return;
    }

    // Check if user has previously verified
    const checkPrevious = async () => {
      // New users (created within last 5 minutes) always see the gate
      const createdAt = new Date(user.created_at).getTime();
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const isNewUser = createdAt > fiveMinAgo;

      if (!isNewUser) {
        // For existing users, check channel membership silently
        try {
          const res = await checkRequiredChannelMembership(user.telegram_id);
          if (res.community && res.payments) {
            setVerified(true);
          }
          // If not in channels, the gate will show (they may have left)
        } catch {
          // On error, allow access for existing users (don't block them)
          setVerified(true);
        }
      }
      setLoading(false);
    };
    checkPrevious();
  }, [user]);

  const runCheck = useCallback(async () => {
    if (!user) return;
    setChecking(true);
    setError(null);
    try {
      const res = await checkRequiredChannelMembership(user.telegram_id);
      setResult(res);
      if (res.community && res.payments) {
        setVerified(true);
      }
    } catch {
      setError('Unable to verify channel membership. Please try again.');
    } finally {
      setChecking(false);
    }
  }, [user]);

  if (loading) return <>{children}</>;
  if (verified) return <>{children}</>;

  const communityOk = result?.community ?? false;
  const paymentsOk = result?.payments ?? false;

  return (
    <div className="min-h-dvh bg-[#0A0A0A] honeycomb-bg flex flex-col items-center justify-center px-6 py-10">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden border-2 border-hive-gold/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/IMG_20260901_111414_330.jpg" alt="Hive Earn" className="w-full h-full object-cover" />
          </motion.div>
          <h1 className="text-white font-black text-2xl mb-2">Join Our Channels</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            To use Hive Earn, you must join both of our official Telegram channels. Join, then tap verify.
          </p>
        </div>

        {/* Channel cards */}
        <div className="space-y-3 mb-6">
          {/* Community channel */}
          <a
            href={`https://t.me/${REQUIRED_CHANNELS.community}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <motion.div
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                communityOk
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-blue-500/10 border-blue-500/20 hover:border-blue-400/40'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Users size={20} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Community Channel</p>
                <p className="text-white/40 text-xs">@{REQUIRED_CHANNELS.community}</p>
              </div>
              {communityOk ? (
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-white" />
                </div>
              ) : (
                <span className="text-blue-400 text-xs font-bold flex-shrink-0">JOIN</span>
              )}
            </motion.div>
          </a>

          {/* Payments channel */}
          <a
            href={`https://t.me/${REQUIRED_CHANNELS.payments}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <motion.div
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                paymentsOk
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-green-500/10 border-green-500/20 hover:border-green-400/40'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
                <CreditCard size={20} className="text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Payments Channel</p>
                <p className="text-white/40 text-xs">@{REQUIRED_CHANNELS.payments}</p>
              </div>
              {paymentsOk ? (
                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-white" />
                </div>
              ) : (
                <span className="text-green-400 text-xs font-bold flex-shrink-0">JOIN</span>
              )}
            </motion.div>
          </a>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20"
            >
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-xs">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Partial result hint */}
        {result && !(communityOk && paymentsOk) && !checking && (
          <div className="p-3 mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-yellow-300/80 text-xs text-center">
              {(!communityOk && !paymentsOk)
                ? 'You haven\'t joined either channel yet. Please join both, then verify.'
                : !communityOk
                ? 'Please join the Community channel, then verify.'
                : 'Please join the Payments channel, then verify.'}
            </p>
          </div>
        )}

        {/* Verify button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={runCheck}
          disabled={checking}
          className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,#F5C518,#FFB300)', color: '#0A0A0A' }}
        >
          {checking ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Verify Membership
            </>
          )}
        </motion.button>

        <p className="text-white/30 text-[10px] text-center mt-4">
          You must remain in both channels to keep using the app.
        </p>
      </motion.div>
    </div>
  );
}
