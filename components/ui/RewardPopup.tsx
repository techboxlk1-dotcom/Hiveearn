'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';

interface RewardPopup {
  id: number;
  amount: number;
  title: string;
  subtitle: string;
  emoji: string;
}

interface RewardPopupContextValue {
  showReward: (amount: number, title: string, subtitle: string, emoji?: string) => void;
}

const RewardPopupContext = createContext<RewardPopupContextValue | null>(null);

export function useRewardPopup() {
  const ctx = useContext(RewardPopupContext);
  if (!ctx) return { showReward: () => {} };
  return ctx;
}

export function RewardPopupProvider({ children }: { children: ReactNode }) {
  const [popups, setPopups] = useState<RewardPopup[]>([]);

  const showReward = useCallback((amount: number, title: string, subtitle: string, emoji = '🍯') => {
    const id = Date.now() + Math.random();
    setPopups(prev => [...prev, { id, amount, title, subtitle, emoji }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => setPopups(prev => prev.filter(p => p.id !== id));

  return (
    <RewardPopupContext.Provider value={{ showReward }}>
      {children}
      <div className="fixed inset-0 z-[100] pointer-events-none flex flex-col items-center justify-center gap-3 px-4">
        <AnimatePresence>
          {popups.map(popup => (
            <motion.div
              key={popup.id}
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="pointer-events-auto relative w-full max-w-xs"
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a1a0a] via-[#0f0f0f] to-[#0A0A0A] border border-hive-gold/30 shadow-2xl shadow-hive-gold/10">
                <div className="absolute inset-0 bg-gradient-to-br from-hive-gold/10 via-transparent to-transparent" />
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-hive-gold/20 blur-3xl" />

                <button
                  onClick={() => dismiss(popup.id)}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors"
                >
                  <X size={12} />
                </button>

                <div className="relative p-6 text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                    className="text-5xl mb-3"
                  >
                    {popup.emoji}
                  </motion.div>

                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, delay: 0.2 }}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/15 border border-green-500/30 mb-3"
                  >
                    <CheckCircle2 size={18} className="text-green-400" />
                  </motion.div>

                  <h3 className="text-white font-black text-lg mb-1">{popup.title}</h3>
                  <p className="text-white/50 text-xs mb-3">{popup.subtitle}</p>

                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-hive-gold/15 border border-hive-gold/30"
                  >
                    <span className="text-hive-gold font-black text-xl">+{popup.amount}</span>
                    <span className="text-hive-gold/70 text-sm font-bold">🍯</span>
                  </motion.div>

                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 4, ease: 'linear' }}
                    className="absolute bottom-0 left-0 h-0.5 bg-hive-gold/40"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </RewardPopupContext.Provider>
  );
}
