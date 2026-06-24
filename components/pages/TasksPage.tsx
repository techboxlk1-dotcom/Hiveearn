'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getTasks, getUserTaskCompletions, startTask, verifyTask } from '@/lib/api';
import type { Task } from '@/lib/supabase';
import { toast } from 'sonner';

const tabs = ['main', 'partner', 'community'] as const;
type TabType = typeof tabs[number];

interface TaskWithStatus extends Task {
  completion_status?: 'pending' | 'verified' | 'rejected';
}

export default function TasksPage() {
  const { user, refreshUser } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('main');
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getTasks(), getUserTaskCompletions(user.id)]).then(([allTasks, completions]) => {
      const withStatus = allTasks.map(t => ({ ...t, completion_status: completions[t.id] as TaskWithStatus['completion_status'] }));
      setTasks(withStatus);
      setLoading(false);
    });
  }, [user]);

  const filteredTasks = tasks.filter(t => t.category === activeTab);

  const handleJoin = async (task: TaskWithStatus) => {
    if (!user || actionLoading) return;
    if (task.telegram_link) window.open(task.telegram_link, '_blank');
    if (!task.completion_status) {
      setActionLoading(task.id);
      await startTask(user.id, task.id);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completion_status: 'pending' } : t));
      setActionLoading(null);
    }
  };

  const handleVerify = async (task: TaskWithStatus) => {
    if (!user || actionLoading) return;
    setActionLoading(task.id);
    const result = await verifyTask(user.id, task.id);
    if (result.success) {
      toast.success(result.message, { icon: '✅' });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completion_status: 'verified' } : t));
      await refreshUser();
    } else {
      toast.error(result.message);
    }
    setActionLoading(null);
  };

  const tabLabels: Record<TabType, string> = { main: 'Main', partner: 'Partner', community: 'Community' };

  return (
    <div className="min-h-dvh px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <motion.div whileTap={{ scale: 0.85 }} className="w-10 h-10 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft size={18} className="text-white/70" />
          </motion.div>
        </Link>
        <div>
          <h1 className="text-white font-bold text-lg">Tasks</h1>
          <p className="text-white/40 text-xs">Complete tasks to earn Hive</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-white/[0.04] rounded-2xl">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            {activeTab === tab && (
              <motion.div layoutId="task-tab" className="absolute inset-0 btn-hive rounded-xl" />
            )}
            <span className={`relative z-10 ${activeTab === tab ? 'text-black' : 'text-white/50'}`}>
              {tabLabels[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Tasks list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tasks in this category yet</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-3"
          >
            {filteredTasks.map((task, index) => {
              const status = task.completion_status;
              const isLoading = actionLoading === task.id;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.07 }}
                >
                  <GlassCard className={`p-4 ${status === 'verified' ? 'opacity-70' : ''}`} animate={false}>
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-2xl bg-hive-gold/10 border border-hive-gold/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {task.icon_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={task.icon_url} alt={task.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{activeTab === 'community' ? '👥' : activeTab === 'partner' ? '🤝' : '⭐'}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-white font-semibold text-sm leading-tight">{task.title}</h3>
                          <span className="text-hive-gold font-black text-sm flex-shrink-0">+{task.reward_amount}H</span>
                        </div>
                        {task.description && (
                          <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{task.description}</p>
                        )}
                        {task.telegram_username && (
                          <p className="text-blue-400 text-xs mt-0.5">@{task.telegram_username}</p>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-3">
                          {status === 'verified' ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 rounded-xl">
                              <CheckCircle size={12} className="text-green-400" />
                              <span className="text-green-400 text-xs font-bold">Completed +{task.reward_amount}H</span>
                            </div>
                          ) : status === 'pending' ? (
                            <>
                              {task.telegram_link && (
                                <button
                                  onClick={() => window.open(task.telegram_link!, '_blank')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] rounded-xl text-white/60 text-xs font-medium"
                                >
                                  <ExternalLink size={12} /> Open
                                </button>
                              )}
                              <motion.button
                                onClick={() => handleVerify(task)}
                                disabled={isLoading}
                                whileTap={{ scale: 0.95 }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-xs font-bold disabled:opacity-50"
                              >
                                {isLoading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3 h-3 border border-current/30 border-t-current rounded-full" /> : <CheckCircle size={12} />}
                                Verify
                              </motion.button>
                            </>
                          ) : (
                            <>
                              {task.telegram_link && (
                                <motion.button
                                  onClick={() => handleJoin(task)}
                                  disabled={isLoading}
                                  whileTap={{ scale: 0.95 }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 btn-hive rounded-xl text-xs font-bold disabled:opacity-50"
                                >
                                  <ExternalLink size={12} /> Join
                                </motion.button>
                              )}
                              <div className="flex items-center gap-1 text-white/30 text-[10px]">
                                <Clock size={10} />
                                <span>Join then verify</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
