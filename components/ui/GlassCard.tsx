'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  glow?: boolean;
  hover3d?: boolean;
  gold?: boolean;
  animate?: boolean;
}

export default function GlassCard({ children, glow, hover3d, gold, animate = true, className, ...props }: GlassCardProps) {
  const baseClass = cn(
    'glass-card',
    glow && 'glow-gold',
    gold && 'border-hive-gold/30 bg-gradient-to-br from-hive-gold/8 to-transparent',
    hover3d && 'card-3d cursor-pointer',
    className
  );

  if (!animate) {
    return <div className={baseClass} {...props}>{children}</div>;
  }

  return (
    <motion.div
      className={baseClass}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover3d ? { scale: 1.01 } : undefined}
      {...(props as React.ComponentProps<typeof motion.div>)}
    >
      {children}
    </motion.div>
  );
}
