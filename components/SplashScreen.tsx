'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + Math.random() * 15 + 5;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center z-[100] overflow-hidden">
      {/* Honeycomb background */}
      <div className="absolute inset-0 honeycomb-bg opacity-30" />

      {/* Radial glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(245,197,24,0.12) 0%, transparent 70%)' }}
      />

      {/* Logo container */}
      <motion.div
        initial={{ scale: 0, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: 'spring', stiffness: 200, damping: 20 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Logo image with glow */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-full blur-2xl bg-hive-gold/30 scale-110" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/IMG_20260901_111414_330.jpg"
            alt="Hive Earn"
            className="w-36 h-36 rounded-full object-cover relative z-10 border-2 border-hive-gold/50"
          />
        </motion.div>

        {/* Brand name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-4xl font-black text-gold-gradient tracking-tight">Hive Earn</h1>
          <p className="text-white/50 text-sm mt-1 font-medium tracking-widest uppercase">V2 · Earn USDT</p>
        </motion.div>

        {/* Feature icons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-4 text-white/40 text-xs font-medium flex-wrap justify-center max-w-xs"
        >
          {[
            { label: 'Watch Ads', icon: '▶' },
            { label: 'Daily Bonus', icon: '🎁' },
            { label: 'Tasks', icon: '✓' },
            { label: 'Refer', icon: '👥' },
            { label: 'Withdraw', icon: '
            <div key={item.label} className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-lg bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center">
                <span className="text-hive-gold text-sm">{item.icon}</span>
              </div>
              <span className="text-[10px]">{item.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-16 left-0 right-0 px-12"
      >
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: 'linear-gradient(90deg, #F5C518, #FFB300)',
              boxShadow: '0 0 8px rgba(245,197,24,0.6)',
            }}
            transition={{ ease: 'easeOut' }}
          />
        </div>
        <p className="text-white/30 text-xs text-center mt-3 tracking-wider">
          Loading{progress < 100 ? '...' : ' Complete'}
        </p>
      </motion.div>

      {/* Floating hexagons */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-hive-gold/10 text-6xl pointer-events-none select-none"
          style={{ left: `${[10, 80, 15, 75, 5, 90][i]}%`, top: `${[15, 10, 75, 80, 45, 55][i]}%` }}
          animate={{ y: [0, -15, 0], rotate: [0, 10, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
        >
          ⬡
        </motion.div>
      ))}
    </div>
  );
}
 },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <div className="w-9 h-9 rounded-lg bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center">
                <span className="text-hive-gold text-sm">{item.icon}</span>
              </div>
              <span className="text-[10px]">{item.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-16 left-0 right-0 px-12"
      >
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: 'linear-gradient(90deg, #F5C518, #FFB300)',
              boxShadow: '0 0 8px rgba(245,197,24,0.6)',
            }}
            transition={{ ease: 'easeOut' }}
          />
        </div>
        <p className="text-white/30 text-xs text-center mt-3 tracking-wider">
          Loading{progress < 100 ? '...' : ' Complete'}
        </p>
      </motion.div>

      {/* Floating hexagons */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-hive-gold/10 text-6xl pointer-events-none select-none"
          style={{ left: `${[10, 80, 15, 75, 5, 90][i]}%`, top: `${[15, 10, 75, 80, 45, 55][i]}%` }}
          animate={{ y: [0, -15, 0], rotate: [0, 10, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.3 }}
        >
          ⬡
        </motion.div>
      ))}
    </div>
  );
}
