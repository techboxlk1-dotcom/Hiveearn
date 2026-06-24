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
          className="flex items-center gap-6 text-white/40 text-xs font-medium"
        >
          {['Watch Ads', 'Do Tasks', 'Refer & Earn'].map((label) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-lg bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center">
                <span className="text-hive-gold text-base">
                  {label === 'Watch Ads' ? '▶' : label === 'Do Tasks' ? '✓' : '👥'}
                </span>
              </div>
              <span>{label}</span>
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
      {/* Circle background */}
      <circle cx="60" cy="60" r="58" fill="#1A1A0A" stroke="#F5C518" strokeWidth="2" />
      {/* Honeycomb pattern */}
      <circle cx="60" cy="60" r="55" fill="url(#hexPattern)" opacity="0.3" />
      <defs>
        <pattern id="hexPattern" width="16" height="14" patternUnits="userSpaceOnUse">
          <polygon points="8,0 16,4 16,10 8,14 0,10 0,4" fill="none" stroke="#F5C518" strokeWidth="0.3" opacity="0.4" />
        </pattern>
      </defs>
      {/* Bee body */}
      <ellipse cx="60" cy="65" rx="22" ry="28" fill="#F5C518" />
      <ellipse cx="60" cy="65" rx="22" ry="28" fill="url(#beeStripes)" />
      <defs>
        <linearGradient id="beeStripes" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5C518" />
          <stop offset="30%" stopColor="#1A1A1A" />
          <stop offset="50%" stopColor="#F5C518" />
          <stop offset="70%" stopColor="#1A1A1A" />
          <stop offset="100%" stopColor="#F5C518" />
        </linearGradient>
      </defs>
      {/* Head */}
      <circle cx="60" cy="40" r="16" fill="#F5C518" />
      {/* Eyes */}
      <circle cx="55" cy="38" r="4" fill="white" />
      <circle cx="65" cy="38" r="4" fill="white" />
      <circle cx="56" cy="38" r="2.5" fill="#1A1A1A" />
      <circle cx="66" cy="38" r="2.5" fill="#1A1A1A" />
      <circle cx="56.8" cy="37.2" r="0.8" fill="white" />
      <circle cx="66.8" cy="37.2" r="0.8" fill="white" />
      {/* Wink right eye */}
      <path d="M63 36 Q65 35 67 36" stroke="#1A1A1A" strokeWidth="1.5" fill="none" />
      {/* Smile */}
      <path d="M54 44 Q60 48 66 44" stroke="#1A1A1A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Antennae */}
      <line x1="55" y1="25" x2="48" y2="15" stroke="#1A1A1A" strokeWidth="1.5" />
      <line x1="65" y1="25" x2="72" y2="15" stroke="#1A1A1A" strokeWidth="1.5" />
      <circle cx="48" cy="14" r="2.5" fill="#1A1A1A" />
      <circle cx="72" cy="14" r="2.5" fill="#1A1A1A" />
      {/* Wings */}
      <ellipse cx="38" cy="52" rx="16" ry="10" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.9)" strokeWidth="0.5" transform="rotate(-20,38,52)" />
      <ellipse cx="82" cy="52" rx="16" ry="10" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.9)" strokeWidth="0.5" transform="rotate(20,82,52)" />
      {/* USDT coin */}
      <circle cx="85" cy="70" r="14" fill="#26A17B" stroke="#1FA46B" strokeWidth="1" />
      <text x="85" y="75" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">₮</text>
      {/* Thumbs up */}
      <path d="M38 75 Q35 70 36 65 L40 65 Q40 60 44 58 L46 65 Q48 65 48 68 L48 78 Q44 80 38 75Z" fill="#F5C518" stroke="#E5B000" strokeWidth="0.5" />
      {/* Text */}
      <text x="60" y="103" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="Arial">Hive</text>
      <text x="60" y="114" textAnchor="middle" fill="#F5C518" fontSize="10" fontWeight="900" fontFamily="Arial">Earn</text>
    </svg>
  );
}
