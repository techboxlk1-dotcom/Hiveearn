'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Bell, BellOff, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { markNotificationRead } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

const notifMeta: Record<string, { icon: string; color: string; bg: string }> = {
  daily_bonus: { icon: '🎁', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  reward_code: { icon: '⚡', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  referral: { icon: '👥', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  referral_completed: { icon: '🏆', color: 'text-hive-gold', bg: 'bg-hive-gold/10' },
  task_completed: { icon: '✅', color: 'text-green-400', bg: 'bg-green-400/10' },
  withdraw_pending: { icon: '💸', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  withdraw_approved: { icon: '✅', color: 'text-green-400', bg: 'bg-green-400/10' },
  withdraw_rejected: { icon: '❌', color: 'text-red-400', bg: 'bg-red-400/10' },
  suspended: { icon: '🚫', color: 'text-red-400', bg: 'bg-red-400/10' },
  default: { icon: '🔔', color: 'text-white/60', bg: 'bg-white/10' },
};

export default function NotificationsPage() {
  const { notifications, unreadCount, markAllRead, refreshNotifications } = useUser();

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    await refreshNotifications();
  };

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
              <ArrowLeft size={18} className="text-white/70" />
            </motion.div>
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg">Notifications</h1>
            <p className="text-white/40 text-xs">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-hive-gold/10 border border-hive-gold/20">
            <CheckCheck size={14} className="text-hive-gold" />
            <span className="text-hive-gold text-xs font-bold">Mark all read</span>
          </motion.button>
        )}
      </div>

      {notifications.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-24">
          <BellOff size={48} className="text-white/10 mb-4" />
          <p className="text-white/30 font-medium">No notifications yet</p>
          <p className="text-white/20 text-xs mt-1">Start earning to see updates here</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif, i) => {
            const meta = notifMeta[notif.type] ?? notifMeta.default;
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                className={`cursor-pointer transition-all ${!notif.is_read ? 'opacity-100' : 'opacity-60'}`}
              >
                <GlassCard className={`p-3 ${!notif.is_read ? 'border-white/10 bg-white/[0.05]' : ''}`} animate={false}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0 text-xl`}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`font-semibold text-sm ${!notif.is_read ? 'text-white' : 'text-white/70'}`}>{notif.title}</p>
                        {!notif.is_read && <div className="w-2 h-2 rounded-full bg-hive-gold flex-shrink-0" />}
                      </div>
                      <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{notif.message}</p>
                      <p className="text-white/20 text-[10px] mt-1">{timeAgo(notif.created_at)}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
