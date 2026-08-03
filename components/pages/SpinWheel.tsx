'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Dices } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { useUser } from '@/contexts/UserContext';
import { getSpinStatus, playSpinWheel } from '@/lib/api';
import { useAds } from '@/hooks/useAds';
import { useRewardPopup } from '@/components/ui/RewardPopup';
import { toast } from 'sonner';

const SEGMENTS = [
  { value: 2, label: '2', color: '#F5C518' },
  { value: 3, label: '3', color: '#FFB300' },
  { value: 4, label: '4', color: '#FF8F00' },
  { value: 5, label: '5', color: '#FF6B6B' },
  { value: 8, label: '8', color: '#4ECDC4' },
  { value: 12, label: '12', color: '#45B7D1' },
  { value: 15, label: '15', color: '#A78BFA' },
  { value: 20, label: '20', color: '#F472B6' },
];

export default function SpinWheel() {
  const { user, refreshUser } = useUser();
  const { showRandomAd } = useAds();
  const { showReward } = useRewardPopup();
  const [status, setStatus] = useState<{ canSpin: boolean; hoursLeft: number; totalSpins: number }>({ canSpin: false, hoursLeft: 0, totalSpins: 0 });
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonAmount, setWonAmount] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const s = await getSpinStatus(user.id);
    setStatus(s);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSpin = async () => {
    if (!user || spinning || !status.canSpin) return;
    setSpinning(true);
    setWonAmount(null);

    const adResult = await showRandomAd();
    if (!adResult.success) {
      toast.error('You must watch the ad to spin!');
      setSpinning(false);
      return;
    }

    const res = await playSpinWheel(user.id);
    if (!res.success) {
      toast.error(res.message);
      setSpinning(false);
      return;
    }

    const segmentIndex = SEGMENTS.findIndex(s => s.value === res.hive);
    const segmentAngle = 360 / SEGMENTS.length;
    const targetRotation = 360 * 5 + (360 - segmentIndex * segmentAngle - segmentAngle / 2);
    setRotation(prev => prev + targetRotation);

    setTimeout(async () => {
      setWonAmount(res.hive);
      setSpinning(false);
      showReward(res.hive, 'Spin Wheel!', `You won ${res.hive} Hive`, '🎡');
      toast.success(`+${res.hive} Hive from spin!`, { icon: '🎡' });
      await refreshUser();
      await load();
    }, 4000);
  };

  return (
    <div className="space-y-5">
      <GlassCard gold glow className="p-6 text-center" animate={false}>
        <motion.div animate={{ rotate: spinning ? rotation : 0 }} transition={{ duration: spinning ? 4 : 0, ease: 'easeOut' }} className="relative w-56 h-56 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-hive-gold/30 overflow-hidden">
            {SEGMENTS.map((seg, i) => {
              const angle = (360 / SEGMENTS.length) * i;
              return (
                <div key={i} className="absolute top-0 left-1/2 origin-bottom" style={{ transform: `rotate(${angle}deg)`, height: '50%', width: '2px' }}>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 origin-bottom" style={{
                    width: '112px',
                    height: '112px',
                    clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                    background: seg.color,
                    transform: 'translateX(-50%) rotate(90deg)',
                    transformOrigin: 'bottom center',
                  }}>
                    <span className="absolute top-3 left-1/2 -translate-x-1/2 text-black font-black text-lg">{seg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-hive-gold flex items-center justify-center shadow-lg z-10">
            <Dices size={20} className="text-black" />
          </div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-white z-20" />
        </motion.div>

        <h2 className="text-white font-black text-xl mb-1">Spin the Wheel</h2>
        <p className="text-white/40 text-xs mb-4">Win 2-20 Hive per spin! Every 12 hours.</p>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.06] rounded-full mb-4">
          <span className="text-white/40 text-xs">Total spins: <span className="text-hive-gold font-bold">{status.totalSpins}</span></span>
        </div>

        <AnimatePresence mode="wait">
          {status.canSpin ? (
            <motion.button
              key="spin"
              onClick={handleSpin}
              disabled={spinning}
              whileTap={{ scale: 0.95 }}
              className="btn-hive w-full py-4 text-lg font-black rounded-2xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {spinning ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full" />
                  Spinning...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2"><Dices size={20} /> Watch Ad & Spin</span>
              )}
            </motion.button>
          ) : (
            <motion.div
              key="cooldown"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full py-4 rounded-2xl bg-white/[0.06] border border-white/10"
            >
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Clock size={18} />
                <span className="font-semibold">Next spin in {status.hoursLeft}h</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {wonAmount !== null && !spinning && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-4 py-3 bg-hive-gold/10 rounded-xl">
            <p className="text-hive-gold font-black text-2xl">+{wonAmount} 🍯 Hive!</p>
          </motion.div>
        )}
      </GlassCard>

      <div className="grid grid-cols-4 gap-2">
        {SEGMENTS.map((s, i) => (
          <div key={i} className="text-center py-2 rounded-lg" style={{ background: `${s.color}15` }}>
            <p className="font-black text-sm" style={{ color: s.color }}>{s.label}</p>
            <p className="text-white/30 text-[9px]">Hive</p>
          </div>
        ))}
      </div>
    </div>
  );
}
