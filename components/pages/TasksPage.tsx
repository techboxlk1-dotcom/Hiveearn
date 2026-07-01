'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, ExternalLink, ArrowLeft, MessageCircle, Plus, Bot, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { getTasks, getUserTaskCompletions, startTask, verifyTask } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRewardPopup } from '@/components/ui/RewardPopup';

const tabs = ['main', 'partner', 'community'] as const;
type TabType = typeof tabs[number];

interface TaskWithStatus extends Task {
  completion_status?: 'pending' | 'verified' | 'rejected';
}

// Task icon component — handles imgbb URLs and direct image URLs
function TaskIcon({ iconUrl, category }: { iconUrl: string | null; category: string }) {
  const [imageError, setImageError] = useState(false);

  const fallbackEmoji = category === 'community' ? '👥' : category === 'partner' ? '🤝' : '⭐';

  if (!iconUrl || imageError) {
    return <span className="text-xl">{fallbackEmoji}</span>;
  }

  // Handle imgbb URLs:
  // Direct image URLs (i.ibb.co/xxx/image.png) work as-is
  // Page URLs (ibb.co/xxx) need conversion, but we can't reliably guess the extension
  // So we try the URL as-is first, and if it's a page URL, try common patterns
  let imageUrl = iconUrl.trim();

  // If it's an ibb.co page URL (not direct image), try converting
  if (imageUrl.includes('ibb.co') && !imageUrl.includes('i.ibb.co')) {
    // Try direct image URL format — imgbb direct URLs are i.ibb.co/<code>/<filename>.<ext>
    // Since we don't know the extension, try .png and .jpg via onError fallback
    imageUrl = imageUrl.replace('ibb.co', 'i.ibb.co');
    // If no file extension, try appending common ones
    if (!imageUrl.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
      imageUrl = imageUrl + '.png';
    }
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt="Task icon"
      className="w-full h-full object-cover"
      onError={() => {
        // Try .jpg if .png fails (for imgbb URLs)
        if (imageUrl.endsWith('.png')) {
          imageUrl = imageUrl.replace('.png', '.jpg');
          // Force re-render by changing key — but since we can't, use a different approach
          setImageError(false);
          // Use direct DOM manipulation as fallback
          const img = document.querySelector(`img[src="${imageUrl.replace('.jpg', '.png')}"]`) as HTMLImageElement | null;
          if (img) img.src = imageUrl;
          return;
        }
        setImageError(true);
      }}
    />
  );
}

export default function TasksPage() {
  const { user, refreshUser } = useUser();
  const { showReward } = useRewardPopup();
  const [activeTab, setActiveTab] = useState<TabType>('main');
  const [tasks, setTasks] = useState<TaskWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([getTasks(), getUserTaskCompletions(user.id)]).then(([allTasks, completions]) => {
      const withStatus = allTasks.map(t => ({
        ...t,
        completion_status: completions[t.id] as TaskWithStatus['completion_status'],
        task_type: (t as Task & { task_type?: string }).task_type ?? 'channel',
      }));
      setTasks(withStatus);
      setLoading(false);
    });
  }, [user]);

  const filteredTasks = tasks.filter(t => t.category === activeTab);

  const handleJoin = useCallback(async (task: TaskWithStatus) => {
    if (!user || actionLoading) return;
    if (task.telegram_link) window.open(task.telegram_link, '_blank');
    if (!task.completion_status) {
      setActionLoading(task.id);
      await startTask(user.id, task.id);
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completion_status: 'pending' } : t));
      setActionLoading(null);
    }
  }, [user, actionLoading]);

  // For channel tasks: verify via Telegram channel membership check
  // For bot/link tasks: verify on touch (trust verify — user just taps verify after starting)
  const handleVerify = useCallback(async (task: TaskWithStatus) => {
    if (!user || actionLoading) return;
    setActionLoading(task.id);
    setVerifying(task.id);

    try {
      // For channel tasks, check actual Telegram channel membership
      if (task.task_type === 'channel' && task.telegram_link) {
        // Extract channel username from link
        const channelMatch = task.telegram_link.match(/t\.me\/(?:joinchat\/)?(@?[\w-]+)/);
        if (channelMatch) {
          const channel = channelMatch[1].replace('@', '');
          // Call the check-membership edge function
          const { data, error } = await supabase.functions.invoke('check-membership', {
            body: { user_id: user.telegram_id, channel },
          });
          if (error || !data?.is_member) {
            toast.error('You haven\'t joined the channel yet. Please join first, then verify.');
            setActionLoading(null);
            setVerifying(null);
            return;
          }
        }
      }

      // For bot/link tasks: trust verify — just verify on touch
      // For channel tasks: if membership confirmed above, proceed
      const result = await verifyTask(user.id, task.id);
      if (result.success) {
        toast.success(result.message, { icon: '✅' });
        showReward(result.hive, 'Task Completed!', task.title, '✅');
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completion_status: 'verified' } : t));
        await refreshUser();
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Verification failed. Please try again.');
    } finally {
      setActionLoading(null);
      setVerifying(null);
    }
  }, [user, actionLoading, showReward, refreshUser]);

  const tabLabels: Record<TabType, string> = { main: 'Main', partner: 'Partner', community: 'Community' };

  // Support button click handler — opens support chat
  const handleSupportClick = () => {
    const supportText = encodeURIComponent("Hi, I need help with tasks in Hive Earn Mini App.");
    window.open('https://t.me/hiveearnsupport', '_blank');
  };

  // Get task type icon
  const getTaskTypeIcon = (taskType?: string) => {
    if (taskType === 'bot') return <Bot size={10} />;
    if (taskType === 'link') return <LinkIcon size={10} />;
    return null;
  };

  const getTaskTypeLabel = (taskType?: string) => {
    if (taskType === 'bot') return 'Bot Task';
    if (taskType === 'link') return 'Link Task';
    return 'Channel Task';
  };

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

      {/* Add task buttons for partner/community tabs */}
      {(activeTab === 'partner' || activeTab === 'community') && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <GlassCard className="p-4" animate={false}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-white font-semibold text-sm">Add {activeTab === 'partner' ? 'Partner' : 'Community'} Task</p>
                <p className="text-white/40 text-xs">Contact support to add your task</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSupportClick}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs font-bold"
              >
                <Plus size={14} /> Add {activeTab === 'partner' ? 'Partner' : 'Community'} Task
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleSupportClick}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60 text-xs font-bold"
              >
                <MessageCircle size={14} /> Support Chat
              </motion.button>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Tasks list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No tasks in this category yet</p>
          {(activeTab === 'partner' || activeTab === 'community') && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSupportClick}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs font-bold"
            >
              <Plus size={12} className="inline mr-1" /> Add {activeTab} Task
            </motion.button>
          )}
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
                      <div className="w-12 h-12 rounded-xl bg-white/[0.08] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <TaskIcon iconUrl={task.icon_url} category={activeTab} />
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

                        {/* Task type badge */}
                        {task.task_type && task.task_type !== 'channel' && (
                          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-blue-500/10 rounded-full">
                            {getTaskTypeIcon(task.task_type)}
                            <span className="text-blue-400 text-[10px] font-semibold">{getTaskTypeLabel(task.task_type)}</span>
                          </div>
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
                                  <ExternalLink size={12} /> {task.task_type === 'channel' ? 'Join' : 'Start'}
                                </motion.button>
                              )}
                              <div className="flex items-center gap-1 text-white/30 text-[10px]">
                                <Clock size={10} />
                                <span>{task.task_type === 'channel' ? 'Join then verify' : 'Start then verify'}</span>
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
