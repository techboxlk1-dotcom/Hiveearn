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
            src="https://images.pexels.com/photos/1128678/pexels-photo-1128678.jpeg?auto=compress&cs=tinysrgb&w=160"
            alt="Hive Earn"
            className="w-28 h-28 rounded-full object-cover relative z-10 border-2 border-hive-gold/50"
            style={{ display: 'none' }}
          />
          {/* Bee SVG logo */}
          <div className="relative z-10 w-32 h-32 flex items-center justify-center">
            <BeeLogoSVG />
          </div>
        </motion.div>

        {/* Brand name */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-4xl font-black text-gold-gradient tracking-tight">Hive Earn</h1>
          <p className="text-white/50 text-sm mt-1 font-medium tracking-widest uppercase">Earn USDT</p>
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
            { label: 'Spin', icon: '🎡' },
            { label: 'Mini Game', icon: '🎮' },
            { label: 'Mining', icon: '⛏️' },
            { label: 'Giveaway', icon: '🎉' },
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

function BeeLogoSVG() {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#2A2A10" />
          <stop offset="100%" stopColor="#0A0A0A" />
        </radialGradient>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD54F" />
          <stop offset="50%" stopColor="#F5C518" />
          <stop offset="100%" stopColor="#E5B000" />
        </linearGradient>
        <linearGradient id="wingGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </linearGradient>
        <pattern id="hexPattern" width="14" height="12" patternUnits="userSpaceOnUse">
          <polygon points="7,0 14,3.5 14,8.5 7,12 0,8.5 0,3.5" fill="none" stroke="#F5C518" strokeWidth="0.4" opacity="0.5" />
        </pattern>
      </defs>
      {/* Circle background */}
      <circle cx="60" cy="60" r="58" fill="url(#bgGrad)" stroke="#F5C518" strokeWidth="2.5" />
      {/* Honeycomb pattern */}
      <circle cx="60" cy="60" r="55" fill="url(#hexPattern)" opacity="0.25" />
      {/* Wings (behind body) */}
      <ellipse cx="36" cy="50" rx="18" ry="11" fill="url(#wingGrad)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" transform="rotate(-25,36,50)" />
      <ellipse cx="84" cy="50" rx="18" ry="11" fill="url(#wingGrad)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" transform="rotate(25,84,50)" />
      {/* Bee body */}
      <ellipse cx="60" cy="64" rx="22" ry="26" fill="url(#bodyGrad)" />
      {/* Body stripes */}
      <path d="M38 58 Q60 53 82 58" stroke="#1A1A1A" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M38 68 Q60 63 82 68" stroke="#1A1A1A" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M38 78 Q60 73 82 78" stroke="#1A1A1A" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
      {/* Head */}
      <circle cx="60" cy="38" r="15" fill="url(#bodyGrad)" />
      {/* Eyes */}
      <circle cx="55" cy="36" r="3.5" fill="#1A1A1A" />
      <circle cx="65" cy="36" r="3.5" fill="#1A1A1A" />
      <circle cx="56" cy="35" r="1.2" fill="white" />
      <circle cx="66" cy="35" r="1.2" fill="white" />
      {/* Smile */}
      <path d="M54 43 Q60 47 66 43" stroke="#1A1A1A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Antennae */}
      <path d="M54 25 Q50 18 46 14" stroke="#1A1A1A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M66 25 Q70 18 74 14" stroke="#1A1A1A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="46" cy="14" r="3" fill="#F5C518" stroke="#1A1A1A" strokeWidth="0.5" />
      <circle cx="74" cy="14" r="3" fill="#F5C518" stroke="#1A1A1A" strokeWidth="0.5" />
      {/* USDT coin */}
      <circle cx="88" cy="72" r="12" fill="#26A17B" stroke="#1FA46B" strokeWidth="1" />
      <text x="88" y="77" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">{"\u20AE"}</text>
      {/* Thumbs up */}
      <path d="M32 72 Q29 68 30 64 L34 64 Q34 60 38 58 L40 64 Q42 64 42 67 L42 75 Q38 77 32 72Z" fill="#F5C518" stroke="#E5B000" strokeWidth="0.5" />
      {/* Text */}
      <text x="60" y="103" textAnchor="middle" fill="white" fontSize="9" fontWeight="900" fontFamily="Arial">Hive</text>
      <text x="60" y="114" textAnchor="middle" fill="#F5C518" fontSize="9" fontWeight="900" fontFamily="Arial">Earn</text>
    </svg>
  );
}
