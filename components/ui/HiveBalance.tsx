'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { formatHive, formatUsdt, hiveToUsdt } from '@/lib/utils';

interface HiveBalanceProps {
  amount: number;
  showUsdt?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function HiveBalance({ amount, showUsdt = true, size = 'lg' }: HiveBalanceProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, v => formatHive(Math.round(v * 100) / 100));

  useEffect(() => {
    const controls = animate(count, amount, { duration: 1.2, ease: 'easeOut' });
    return controls.stop;
  }, [amount, count]);

  const sizeMap = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
    xl: 'text-5xl',
  };

  return (
    <div className="text-center">
      <div className="flex items-baseline justify-center gap-2">
        <motion.span className={`${sizeMap[size]} font-black text-gold-gradient`}>
          {rounded}
        </motion.span>
        <span className="text-hive-gold/70 font-bold text-lg">🍯 HIVE</span>
      </div>
      {showUsdt && (
        <p className="text-white/40 text-sm mt-1">
          ≈ <span className="text-white/60 font-medium">{formatUsdt(hiveToUsdt(amount))} USDT</span>
        </p>
      )}
    </div>
  );
}
