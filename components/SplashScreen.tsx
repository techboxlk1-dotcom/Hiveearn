'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const features = [
  { label: 'Watch Ads', icon: '▶' },
  { label: 'Daily Bonus', icon: '◆' },
  { label: 'Tasks', icon: '✓' },
  { label: 'Refer', icon: '••' },
  { label: 'Withdraw', icon: '↗' },
];

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(100, current + Math.random() * 15 + 5);
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0A0A0A]">
      <div className="honeycomb-bg absolute inset-0 opacity-30" />
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(245,197,24,0.12) 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ scale: 0, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: 'spring', stiffness: 200, damping: 20 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="relative">
          <div className="absolute inset-0 scale-110 rounded-full bg-hive-gold/30 blur-2xl" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/IMG_20260901_111414_330.jpg" alt="Hive Earn" className="relative z-10 h-36 w-36 rounded-full border-2 border-hive-gold/50 object-cover" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }} className="text-center">
          <h1 className="text-gold-gradient text-4xl font-black tracking-tight">Hive Earn</h1>
          <p className="mt-1 text-sm font-medium uppercase tracking-widest text-white/50">V2 · Earn USDT</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="flex max-w-xs flex-wrap items-center justify-center gap-4 text-xs font-medium text-white/40">
          {features.map((feature) => (
            <div key={feature.label} className="flex flex-col items-center gap-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-hive-gold/20 bg-hive-gold/10">
                <span className="text-sm text-hive-gold">{feature.icon}</span>
              </div>
              <span className="text-[10px]">{feature.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="absolute bottom-16 left-0 right-0 px-12">
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #F5C518, #FFB300)', boxShadow: '0 0 8px rgba(245,197,24,0.6)' }}
            transition={{ ease: 'easeOut' }}
          />
        </div>
        <p className="mt-3 text-center text-xs tracking-wider text-white/30">Loading{progress < 100 ? '...' : ' Complete'}</p>
      </motion.div>

      {[...Array(6)].map((_, index) => (
        <motion.div
          key={index}
          className="pointer-events-none absolute select-none text-6xl text-hive-gold/10"
          style={{ left: `${[10, 80, 15, 75, 5, 90][index]}%`, top: `${[15, 10, 75, 80, 45, 55][index]}%` }}
          animate={{ y: [0, -15, 0], rotate: [0, 10, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3 + index * 0.5, repeat: Infinity, delay: index * 0.3 }}
        >
          ⬡
        </motion.div>
      ))}
    </div>
  );
}
