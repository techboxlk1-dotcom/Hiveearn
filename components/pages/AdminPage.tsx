'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, DollarSign, CheckSquare, Megaphone, Gift, Shield, BarChart2, Plus, Check, X, Search, Trash2, Eye, ChevronLeft, Send, Tv, Settings, Globe, UserCog, Wrench, Activity, Star, StarOff } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { supabase } from '@/lib/supabase';
import type { User, Withdrawal, RewardCode, Task, Announcement, FraudLog, AdminLog } from '@/lib/supabase';
import { getAllUsers, approveWithdrawal, rejectWithdrawal, createRewardCode, suspendUser, unsuspendUser, createAnnouncement, createTask, getAdminStats, blockIp, broadcastMessage, createAdProvider, updateAdProvider, deleteAdProvider, updateAppSetting, getAppSettings, setManager, listUser, unlistUser, getUserActivity } from '@/lib/api';
import { formatHive, formatUsdt, hiveToUsdt, timeAgo, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';

type AdminSection = 'dashboard' | 'users' | 'withdrawals' | 'reward_codes' | 'tasks' | 'announcements' | 'fraud' | 'logs' | 'broadcast' | 'ads' | 'visit_sites' | 'settings';

export default function AdminPage() {
  const { user, isAdmin } = useUser();
  const [section, setSection] = useState<AdminSection>('dashboard');
  const [stats, setStats] = useState({ totalUsers: 0, pendingWithdrawals: 0, totalTasks: 0, settings: [] as Array<{ key: string; value: string }> });

  useEffect(() => { if (user && isAdmin) getAdminStats().then(s => setStats(s as typeof stats)); }, [user, isAdmin]);

  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4">
        <Shield size={48} className="text-red-400 mb-4" />
        <h1 className="text-white font-black text-xl mb-2">Access Denied</h1>
        <p className="text-white/40 text-sm text-center mb-6">You don't have admin privileges</p>
        <Link href="/" className="btn-hive px-6 py-3 rounded-xl font-bold">Go Home</Link>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'withdrawals', label: 'Withdrawals', icon: DollarSign },
    { id: 'reward_codes', label: 'Reward Codes', icon: Gift },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'broadcast', label: 'Broadcast', icon: Send },
    { id: 'ads', label: 'Ad Providers', icon: Tv },
    { id: 'visit_sites', label: 'Visit Sites', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'fraud', label: 'Fraud Logs', icon: Shield },
    { id: 'logs', label: 'Admin Logs', icon: Eye },
  ] as const;

  return (
    <div className="min-h-dvh bg-[#0A0A0A]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
        <Link href="/">
          <motion.div whileTap={{ scale: 0.85 }} className="w-8 h-8 rounded-lg glass-card flex items-center justify-center">
            <ChevronLeft size={16} className="text-white/70" />
          </motion.div>
        </Link>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-red-400" />
          <h1 className="text-white font-bold">Admin Panel</h1>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 rounded-full">
          <span className="text-red-400 text-xs font-bold">ADMIN</span>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex overflow-x-auto gap-2 px-4 py-3 border-b border-white/[0.06]">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id as AdminSection)}
            className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${section === id ? 'bg-hive-gold text-black' : 'bg-white/[0.06] text-white/50'}`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 pb-8">
        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {section === 'dashboard' && <AdminDashboard stats={stats} />}
            {section === 'users' && <AdminUsers adminId={user.id} />}
            {section === 'withdrawals' && <AdminWithdrawals adminId={user.id} />}
            {section === 'reward_codes' && <AdminRewardCodes adminId={user.id} />}
            {section === 'tasks' && <AdminTasks adminId={user.id} />}
            {section === 'announcements' && <AdminAnnouncements adminId={user.id} />}
            {section === 'broadcast' && <AdminBroadcast adminId={user.id} />}
            {section === 'ads' && <AdminAds adminId={user.id} />}
            {section === 'visit_sites' && <AdminVisitSites adminId={user.id} />}
            {section === 'settings' && <AdminSettings adminId={user.id} />}
            {section === 'fraud' && <AdminFraud />}
            {section === 'logs' && <AdminLogs />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function AdminDashboard({ stats }: { stats: { totalUsers: number; pendingWithdrawals: number; totalTasks: number } }) {
  const [dbStats, setDbStats] = useState({ totalHive: 0, totalWithdrawals: 0, todayUsers: 0, totalPaidUsdt: 0, pendingUsdt: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('hive_balance'),
      supabase.from('withdrawals').select('net_amount, status'),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]).then(([{ data: users }, { data: withdrawals }, { count: todayCount }]) => {
      const approved = (withdrawals ?? []).filter(w => w.status === 'approved');
      const pending = (withdrawals ?? []).filter(w => w.status === 'pending');
      setDbStats({
        totalHive: (users ?? []).reduce((sum, u) => sum + (u.hive_balance ?? 0), 0),
        totalWithdrawals: (withdrawals ?? []).length,
        todayUsers: todayCount ?? 0,
        totalPaidUsdt: approved.reduce((sum, w) => sum + (w.net_amount ?? 0), 0),
        pendingUsdt: pending.reduce((sum, w) => sum + (w.net_amount ?? 0), 0),
      });
    });
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: 'Total Hive Issued', value: formatHive(dbStats.totalHive), icon: BarChart2, color: 'text-hive-gold', bg: 'bg-hive-gold/10' },
    { label: 'New Today', value: dbStats.todayUsers, icon: Users, color: 'text-green-400', bg: 'bg-green-400/10' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <GlassCard key={label} className="p-4" animate={false}>
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
              <Icon size={18} className={color} />
            </div>
            <p className={`font-black text-xl ${color}`}>{value}</p>
            <p className="text-white/40 text-xs">{label}</p>
          </GlassCard>
        ))}
      </div>
      <GlassCard gold glow className="p-4" animate={false}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white/60 font-semibold text-sm">Total Paid Out</h3>
          <span className="text-green-400 text-xs font-bold">USDT (BEP20)</span>
        </div>
        <p className="text-green-400 font-black text-2xl">${dbStats.totalPaidUsdt.toFixed(2)}</p>
        <p className="text-white/30 text-xs mt-1">Approved withdrawals total</p>
      </GlassCard>
      <GlassCard className="p-4" animate={false}>
        <h3 className="text-white/60 font-semibold text-sm mb-3">Quick Stats</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-white/40">Total Withdrawals</span><span className="text-white/70 font-bold">{dbStats.totalWithdrawals}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Pending Amount</span><span className="text-yellow-400 font-bold">${dbStats.pendingUsdt.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Total Tasks</span><span className="text-white/70 font-bold">{stats.totalTasks}</span></div>
          <div className="flex justify-between"><span className="text-white/40">Admin</span><span className="text-hive-gold font-bold">You</span></div>
        </div>
      </GlassCard>
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function AdminUsers({ adminId }: { adminId: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activityUser, setActivityUser] = useState<User | null>(null);
  const [activity, setActivity] = useState<{ user: User | null; transactions: Array<{ id: string; type: string; amount: number; created_at: string; description: string | null }>; totalAds: number; totalWithdrawals: number; totalWithdrawnUsdt: number; totalTasksCompleted: number; totalReferrals: number; completedReferrals: number; expectedBalance: number; actualBalance: number; balanceMismatch: boolean } | null>(null);

  useEffect(() => { getAllUsers(undefined, 30).then(u => { setUsers(u); setLoading(false); }); }, []);

  const handleSearch = async () => {
    setLoading(true);
    const us = await getAllUsers(search || undefined);
    setUsers(us);
    setLoading(false);
  };

  const handleToggleSuspend = async (u: User) => {
    if (u.is_suspended) {
      await unsuspendUser(adminId, u.id);
      toast.success(`Unsuspended ${u.first_name}`);
    } else {
      const reason = prompt('Suspension reason:');
      if (!reason) return;
      await suspendUser(adminId, u.id, reason);
      toast.success(`Suspended ${u.first_name}`);
    }
    setUsers(prev => prev.map(pu => pu.id === u.id ? { ...pu, is_suspended: !u.is_suspended } : pu));
  };

  const handleToggleManager = async (u: User) => {
    const result = await setManager(adminId, u.id, !u.is_manager);
    if (result.success) {
      toast.success(u.is_manager ? 'Manager role removed' : 'Manager role granted');
      setUsers(prev => prev.map(pu => pu.id === u.id ? { ...pu, is_manager: !u.is_manager } : pu));
    } else {
      toast.error(result.message);
    }
  };

  const handleToggleList = async (u: User) => {
    if (u.listed) {
      await unlistUser(adminId, u.id);
      toast.success('User unlisted');
    } else {
      const reason = prompt('Reason for listing:');
      if (!reason) return;
      await listUser(adminId, u.id, reason);
      toast.success('User listed');
    }
    setUsers(prev => prev.map(pu => pu.id === u.id ? { ...pu, listed: !u.listed } : pu));
  };

  const handleViewActivity = async (u: User) => {
    setActivityUser(u);
    const act = await getUserActivity(u.id);
    setActivity(act);
  };

  if (activityUser && activity) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setActivityUser(null); setActivity(null); }} className="px-3 py-2 bg-white/[0.06] rounded-xl text-xs font-bold text-white/70">
            <ChevronLeft size={14} className="inline mr-1" /> Back
          </motion.button>
          <span className="text-white/60 text-xs">Activity for {activityUser.first_name}</span>
        </div>

        <GlassCard className="p-4 space-y-3" animate={false}>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 bg-white/[0.04] rounded-lg">
              <p className="text-hive-gold font-black text-lg">{activity.totalAds}</p>
              <p className="text-white/40 text-[10px]">Ads Watched</p>
            </div>
            <div className="text-center p-2 bg-white/[0.04] rounded-lg">
              <p className="text-green-400 font-black text-lg">{activity.totalTasksCompleted}</p>
              <p className="text-white/40 text-[10px]">Tasks Completed</p>
            </div>
            <div className="text-center p-2 bg-white/[0.04] rounded-lg">
              <p className="text-blue-400 font-black text-lg">{activity.totalReferrals}</p>
              <p className="text-white/40 text-[10px]">Referrals ({activity.completedReferrals} done)</p>
            </div>
            <div className="text-center p-2 bg-white/[0.04] rounded-lg">
              <p className="text-red-400 font-black text-lg">${activity.totalWithdrawnUsdt.toFixed(2)}</p>
              <p className="text-white/40 text-[10px]">Total Withdrawn</p>
            </div>
          </div>
          <div className="pt-2 border-t border-white/[0.06] flex justify-between">
            <span className="text-white/40 text-xs">Balance Check</span>
            {activity.balanceMismatch ? (
              <span className="text-red-400 text-xs font-bold">MISMATCH: Expected {activity.expectedBalance.toFixed(2)}H</span>
            ) : (
              <span className="text-green-400 text-xs font-bold">OK ({activity.actualBalance.toFixed(2)}H)</span>
            )}
          </div>
        </GlassCard>

        <h3 className="text-white/40 text-xs font-semibold uppercase tracking-widest">Recent Transactions</h3>
        <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
          {activity.transactions.length === 0 && <p className="text-white/30 text-xs text-center py-6">No transactions</p>}
          {activity.transactions.slice(0, 20).map((tx, i) => (
            <div key={i} className="p-3">
              <p className="text-white/70 text-xs font-semibold capitalize">{tx.description ?? tx.type.replace('_', ' ')}</p>
              <div className="flex justify-between">
                <p className="text-white/40 text-[10px]">{timeAgo(tx.created_at)}</p>
                <p className={`font-bold text-xs ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>{tx.amount > 0 ? '+' : ''}{tx.amount}H</p>
              </div>
            </div>
          ))}
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Search users..." className="w-full pl-9 pr-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none" />
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={handleSearch} className="px-3 py-2 btn-hive rounded-xl text-xs font-bold">Search</motion.button>
      </div>

      {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded-xl" />)}</div> : (
        <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-2 p-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm flex-shrink-0">{(u.first_name ?? 'U')[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-medium truncate">{u.first_name} {u.username && <span className="text-white/40">@{u.username}</span>}</p>
                <p className="text-hive-gold text-[10px]">{formatHive(u.hive_balance)} H {u.is_admin && <span className="text-red-400">• Admin</span>} {u.is_manager && <span className="text-blue-400">• Manager</span>} {u.listed && <span className="text-green-400">• Listed</span>}</p>
              </div>
              <div className="flex gap-1">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleViewActivity(u)} className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400" title="View Activity">
                  <Activity size={12} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggleManager(u)} className={`p-1.5 rounded-lg ${u.is_manager ? 'bg-blue-500/15 text-blue-400' : 'bg-white/[0.06] text-white/30'}`} title="Toggle Manager">
                  <UserCog size={12} />
                </motion.button>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggleList(u)} className={`p-1.5 rounded-lg ${u.listed ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/30'}`} title="Toggle Listed">
                  {u.listed ? <Star size={12} /> : <StarOff size={12} />}
                </motion.button>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggleSuspend(u)} className={`p-1.5 rounded-lg ${u.is_suspended ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`} title="Suspend">
                  {u.is_suspended ? <Check size={12} /> : <X size={12} />}
                </motion.button>
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────
function AdminWithdrawals({ adminId }: { adminId: string }) {
  const [withdrawals, setWithdrawals] = useState<Array<Withdrawal & { users: User | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [txidInputs, setTxidInputs] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('withdrawals').select('*, users(*)').eq('status', filter).order('created_at', { ascending: false }).limit(30);
    setWithdrawals((data as Array<Withdrawal & { users: User | null }>) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (wd: Withdrawal) => {
    const txid = txidInputs[wd.id]?.trim();
    if (!txid) {
      toast.error('Please enter TXID');
      return;
    }
    await approveWithdrawal(adminId, wd.id, txid);
    toast.success('Withdrawal approved');
    setTxidInputs(prev => { const n = { ...prev }; delete n[wd.id]; return n; });
    load();
  };

  const handleReject = async (wd: Withdrawal) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await rejectWithdrawal(adminId, wd.id, reason);
    toast.success('Withdrawal rejected');
    load();
  };

  const statusColor = { pending: 'text-yellow-400', approved: 'text-green-400', rejected: 'text-red-400', processing: 'text-blue-400' };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {['pending', 'approved', 'rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize ${filter === s ? 'bg-hive-gold text-black' : 'bg-white/[0.06] text-white/50'}`}>{s}</button>
        ))}
      </div>
      {loading ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div> : (
        <div className="space-y-2">
          {withdrawals.length === 0 && <p className="text-white/30 text-sm text-center py-8">No {filter} withdrawals</p>}
          {withdrawals.map(wd => (
            <GlassCard key={wd.id} className="p-3" animate={false}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white/80 text-xs font-semibold">{(wd as unknown as { users: User | null }).users?.first_name ?? 'User'}</p>
                  <p className="text-white/30 text-[10px] font-mono">{truncateAddress(wd.wallet_address)}</p>
                  <p className="text-white/40 text-[10px]">{(wd as { withdraw_id?: string }).withdraw_id ?? 'WD-??????'}</p>
                  <p className="text-white/20 text-[10px]">{timeAgo(wd.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-black">{formatUsdt(wd.net_amount)} USDT</p>
                  <p className="text-white/40 text-[10px]">{formatHive(wd.hive_amount)} H</p>
                  <p className={`text-[10px] font-bold capitalize ${statusColor[wd.status]}`}>{wd.status}</p>
                </div>
              </div>
              {wd.status === 'pending' && (
                <div className="space-y-2">
                  {/* TXID Input */}
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">TXID (for manual approval)</label>
                    <input
                      type="text"
                      placeholder="Enter transaction hash..."
                      value={txidInputs[wd.id] || ''}
                      onChange={e => setTxidInputs(prev => ({ ...prev, [wd.id]: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.06] border border-white/[0.08] rounded-lg text-white text-xs font-mono placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30"
                    />
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleApprove(wd)}
                      disabled={!txidInputs[wd.id]?.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/15 border border-green-500/20 rounded-xl text-green-400 text-xs font-bold disabled:opacity-40"
                    >
                      <Check size={12} /> Manual Approve
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleReject(wd)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/15 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                      <X size={12} /> Reject
                    </motion.button>
                  </div>
                </div>
              )}
              {wd.txid && <p className="text-green-400/60 text-[10px] font-mono mt-1 truncate">TXID: {wd.txid}</p>}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reward Codes ─────────────────────────────────────────────────────────────
function AdminRewardCodes({ adminId }: { adminId: string }) {
  const [codes, setCodes] = useState<RewardCode[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', reward: '', limit: '', expires: '', description: '' });

  const load = () => supabase.from('reward_codes').select('*').order('created_at', { ascending: false }).then(({ data }) => setCodes(data ?? []));

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.code || !form.reward) { toast.error('Code and reward required'); return; }
    const result = await createRewardCode(adminId, form.code, parseFloat(form.reward), form.limit ? parseInt(form.limit) : undefined, form.expires || undefined, form.description || undefined);
    if (result.success) { toast.success('Code created!'); setShowForm(false); setForm({ code: '', reward: '', limit: '', expires: '', description: '' }); load(); }
    else toast.error(result.message);
  };

  const handleToggle = async (code: RewardCode) => {
    await supabase.from('reward_codes').update({ is_active: !code.is_active }).eq('id', code.id);
    toast.success(code.is_active ? 'Code disabled' : 'Code enabled');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this code?')) return;
    await supabase.from('reward_codes').delete().eq('id', id);
    toast.success('Deleted');
    load();
  };

  return (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowForm(!showForm)} className="w-full flex items-center justify-center gap-2 py-3 btn-hive rounded-xl font-bold text-sm">
        <Plus size={16} /> {showForm ? 'Cancel' : 'Create Reward Code'}
      </motion.button>

      {showForm && (
        <GlassCard className="p-4 space-y-3" animate={false}>
          {[
            { key: 'code', placeholder: 'CODE (e.g. HIVE2024)', label: 'Code *' },
            { key: 'reward', placeholder: 'e.g. 50', label: 'Reward (Hive) *', type: 'number' },
            { key: 'limit', placeholder: 'Leave empty for unlimited', label: 'Usage Limit', type: 'number' },
            { key: 'expires', placeholder: '', label: 'Expires At', type: 'datetime-local' },
            { key: 'description', placeholder: 'Optional description', label: 'Description' },
          ].map(({ key, placeholder, label, type }) => (
            <div key={key}>
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
              <input type={type ?? 'text'} placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: type === 'text' || !type ? e.target.value.toUpperCase() : e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30" />
            </div>
          ))}
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreate} className="w-full py-3 btn-hive rounded-xl font-bold text-sm">Create Code</motion.button>
        </GlassCard>
      )}

      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
        {codes.length === 0 && <p className="text-white/30 text-xs text-center py-6">No codes created yet</p>}
        {codes.map(code => (
          <div key={code.id} className="flex items-center gap-2 p-3">
            <div className="flex-1 min-w-0">
              <p className={`font-mono font-bold text-sm ${code.is_active ? 'text-hive-gold' : 'text-white/30 line-through'}`}>{code.code}</p>
              <p className="text-white/40 text-[10px]">+{code.reward_amount}H • {code.usage_count}/{code.usage_limit ?? '∞'} used{code.expires_at ? ` • exp ${new Date(code.expires_at).toLocaleDateString()}` : ''}</p>
            </div>
            <div className="flex gap-1">
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggle(code)} className={`p-1.5 rounded-lg ${code.is_active ? 'bg-yellow-500/15 text-yellow-400' : 'bg-green-500/15 text-green-400'}`}>
                {code.is_active ? <X size={12} /> : <Check size={12} />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleDelete(code.id)} className="p-1.5 rounded-lg bg-red-500/15 text-red-400">
                <Trash2 size={12} />
              </motion.button>
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
function AdminTasks({ adminId }: { adminId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', reward: '', category: 'main', telegram_link: '', telegram_username: '', icon_url: '', description: '' });

  const load = () => supabase.from('tasks').select('*').order('sort_order').then(({ data }) => setTasks(data ?? []));

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.reward) { toast.error('Title and reward required'); return; }
    await createTask(adminId, { title: form.title, reward_amount: parseFloat(form.reward), category: form.category as Task['category'], telegram_link: form.telegram_link || null, telegram_username: form.telegram_username || null, icon_url: form.icon_url || null, description: form.description || null, is_active: true, requires_verification: true });
    toast.success('Task created!');
    setShowForm(false);
    setForm({ title: '', reward: '', category: 'main', telegram_link: '', telegram_username: '', icon_url: '', description: '' });
    load();
  };

  const handleToggle = async (task: Task) => {
    await supabase.from('tasks').update({ is_active: !task.is_active }).eq('id', task.id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowForm(!showForm)} className="w-full flex items-center justify-center gap-2 py-3 btn-hive rounded-xl font-bold text-sm">
        <Plus size={16} /> {showForm ? 'Cancel' : 'Create Task'}
      </motion.button>

      {showForm && (
        <GlassCard className="p-4 space-y-3" animate={false}>
          {[
            { key: 'title', placeholder: 'Task title *', label: 'Title' },
            { key: 'reward', placeholder: 'e.g. 50', label: 'Reward (Hive) *', type: 'number' },
            { key: 'description', placeholder: 'Optional description', label: 'Description' },
            { key: 'telegram_username', placeholder: 'e.g. hiveearn', label: 'Telegram Username' },
            { key: 'telegram_link', placeholder: 'https://t.me/...', label: 'Telegram Link' },
            { key: 'icon_url', placeholder: 'https://...', label: 'Icon URL' },
          ].map(({ key, placeholder, label, type }) => (
            <div key={key}>
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
              <input type={type ?? 'text'} placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30" />
            </div>
          ))}
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs focus:outline-none">
              <option value="main">Main</option>
              <option value="partner">Partner</option>
              <option value="community">Community</option>
            </select>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreate} className="w-full py-3 btn-hive rounded-xl font-bold text-sm">Create Task</motion.button>
        </GlassCard>
      )}

      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
        {tasks.length === 0 && <p className="text-white/30 text-xs text-center py-6">No tasks created yet</p>}
        {tasks.map(task => (
          <div key={task.id} className="flex items-center gap-2 p-3">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${task.is_active ? 'text-white/80' : 'text-white/30'}`}>{task.title}</p>
              <p className="text-hive-gold text-[10px]">+{task.reward_amount}H • {task.category}</p>
            </div>
            <div className="flex gap-1">
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggle(task)} className={`p-1.5 rounded-lg ${task.is_active ? 'bg-yellow-500/15 text-yellow-400' : 'bg-green-500/15 text-green-400'}`}>
                {task.is_active ? <X size={12} /> : <Check size={12} />}
              </motion.button>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg bg-red-500/15 text-red-400">
                <Trash2 size={12} />
              </motion.button>
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────
function AdminAnnouncements({ adminId }: { adminId: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', type: 'info', pinned: false });

  const load = () => supabase.from('announcements').select('*').order('created_at', { ascending: false }).then(({ data }) => setAnnouncements(data ?? []));

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.content) { toast.error('Title and content required'); return; }
    await createAnnouncement(adminId, form.title, form.content, form.type, form.pinned);
    toast.success('Announcement created!');
    setShowForm(false);
    setForm({ title: '', content: '', type: 'info', pinned: false });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    load();
  };

  const typeColors = { info: 'text-blue-400', warning: 'text-yellow-400', success: 'text-green-400', promotion: 'text-pink-400' };

  return (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowForm(!showForm)} className="w-full flex items-center justify-center gap-2 py-3 btn-hive rounded-xl font-bold text-sm">
        <Plus size={16} /> {showForm ? 'Cancel' : 'Create Announcement'}
      </motion.button>

      {showForm && (
        <GlassCard className="p-4 space-y-3" animate={false}>
          {[
            { key: 'title', placeholder: 'Announcement title *', label: 'Title' },
            { key: 'content', placeholder: 'Full message content *', label: 'Content', multiline: true },
          ].map(({ key, placeholder, label, multiline }) => (
            <div key={key}>
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
              {multiline ? (
                <textarea placeholder={placeholder} value={form[key as keyof typeof form] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} rows={3}
                  className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none resize-none" />
              ) : (
                <input type="text" placeholder={placeholder} value={form[key as keyof typeof form] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none" />
              )}
            </div>
          ))}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs focus:outline-none">
                {['info', 'warning', 'success', 'promotion'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 pt-4">
              <input type="checkbox" id="pinned" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} className="accent-hive-gold" />
              <label htmlFor="pinned" className="text-white/60 text-xs">Pin</label>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreate} className="w-full py-3 btn-hive rounded-xl font-bold text-sm">Post Announcement</motion.button>
        </GlassCard>
      )}

      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
        {announcements.length === 0 && <p className="text-white/30 text-xs text-center py-6">No announcements yet</p>}
        {announcements.map(a => (
          <div key={a.id} className="flex items-start gap-2 p-3">
            <div className="flex-1">
              <p className={`text-xs font-semibold ${typeColors[a.type as keyof typeof typeColors] ?? 'text-white/70'}`}>{a.title} {a.pinned && '📌'}</p>
              <p className="text-white/40 text-[10px] line-clamp-2">{a.content}</p>
              <p className="text-white/20 text-[9px] mt-0.5">{timeAgo(a.created_at)}</p>
            </div>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg bg-red-500/15 text-red-400 flex-shrink-0">
              <Trash2 size={12} />
            </motion.button>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── Fraud ────────────────────────────────────────────────────────────────────
function AdminFraud() {
  const { user } = useUser();
  const [logs, setLogs] = useState<FraudLog[]>([]);
  const [blockedIps, setBlockedIps] = useState<Array<{ id: string; ip_address: string; reason: string; created_at: string }>>([]);
  const [suspendedUsers, setSuspendedUsers] = useState<User[]>([]);
  const [ipInput, setIpInput] = useState('');
  const [ipReason, setIpReason] = useState('');
  const [tab, setTab] = useState<'logs' | 'ips' | 'suspended'>('logs');

  const load = () => {
    supabase.from('fraud_logs').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => setLogs(data ?? []));
    supabase.from('ip_blocks').select('*').order('created_at', { ascending: false }).then(({ data }) => setBlockedIps(data ?? []));
    supabase.from('users').select('*').eq('is_suspended', true).order('created_at', { ascending: false }).then(({ data }) => setSuspendedUsers(data ?? []));
  };

  useEffect(() => { load(); }, []);

  const handleBlockIp = async () => {
    if (!user || !ipInput.trim() || !ipReason.trim()) return;
    await blockIp(user.id, ipInput.trim(), ipReason.trim());
    setIpInput(''); setIpReason('');
    toast.success(`IP ${ipInput} blocked`);
    load();
  };

  const handleUnblockIp = async (ip: string) => {
    await supabase.from('ip_blocks').delete().eq('ip_address', ip);
    toast.success('IP unblocked');
    load();
  };

  const handleUnsuspend = async (u: User) => {
    if (!user) return;
    await unsuspendUser(user.id, u.id);
    toast.success(`Unsuspended ${u.first_name}`);
    load();
  };

  const severityColor = { low: 'text-blue-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400' };

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-2 p-1 bg-white/[0.04] rounded-xl">
        {(['logs', 'ips', 'suspended'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-hive-gold text-black' : 'text-white/50'}`}>
            {t === 'logs' ? `Fraud Logs` : t === 'ips' ? `Block IPs` : `Suspended`}
          </button>
        ))}
      </div>

      {tab === 'logs' && (
        <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
          {logs.length === 0 && <p className="text-white/30 text-xs text-center py-6">No fraud logs</p>}
          {logs.map(log => (
            <div key={log.id} className="p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white/70 text-xs font-semibold capitalize">{log.type.replace(/_/g, ' ')}</p>
                <span className={`text-[10px] font-bold ${severityColor[log.severity]}`}>{log.severity}</span>
              </div>
              {log.ip_address && <p className="text-white/40 text-[10px] font-mono">IP: {log.ip_address}</p>}
              <p className="text-white/40 text-[10px]">{log.description ?? 'No description'}</p>
              <p className="text-white/20 text-[9px] mt-1">{timeAgo(log.created_at)}</p>
            </div>
          ))}
        </GlassCard>
      )}

      {tab === 'ips' && (
        <div className="space-y-3">
          <GlassCard className="p-4 space-y-3" animate={false}>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Block IP Address</p>
            <input value={ipInput} onChange={e => setIpInput(e.target.value)} placeholder="e.g. 192.168.1.1" className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none font-mono" />
            <input value={ipReason} onChange={e => setIpReason(e.target.value)} placeholder="Reason for blocking" className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none" />
            <motion.button whileTap={{ scale: 0.96 }} onClick={handleBlockIp} disabled={!ipInput || !ipReason} className="w-full py-2.5 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold disabled:opacity-40">
              🚫 Block IP & Suspend All Users on This IP
            </motion.button>
          </GlassCard>

          <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
            {blockedIps.length === 0 && <p className="text-white/30 text-xs text-center py-4">No blocked IPs</p>}
            {blockedIps.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-red-400 font-mono text-xs">{b.ip_address}</p>
                  <p className="text-white/30 text-[10px]">{b.reason}</p>
                </div>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleUnblockIp(b.ip_address)} className="px-2 py-1 rounded-lg bg-green-500/15 text-green-400 text-[10px] font-bold">Unblock</motion.button>
              </div>
            ))}
          </GlassCard>
        </div>
      )}

      {tab === 'suspended' && (
        <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
          {suspendedUsers.length === 0 && <p className="text-white/30 text-xs text-center py-6">No suspended users</p>}
          {suspendedUsers.map(u => (
            <div key={u.id} className="flex items-start gap-2 p-3">
              <div className="flex-1">
                <p className="text-white/80 text-xs font-semibold">{u.first_name} {u.username && <span className="text-white/40">@{u.username}</span>}</p>
                <p className="text-red-400/70 text-[10px]">{u.suspension_reason ?? 'No reason'}</p>
                {u.ip_address && <p className="text-white/20 text-[10px] font-mono">IP: {u.ip_address}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleUnsuspend(u)} className="px-2 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-[10px] font-bold flex-shrink-0">Restore</motion.button>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}

// ─── Broadcast ────────────────────────────────────────────────────────────────
function AdminBroadcast({ adminId }: { adminId: string }) {
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttonName, setButtonName] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [sendToChannel, setSendToChannel] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Message cannot be empty'); return; }
    setSending(true);
    setResult(null);
    const res = await broadcastMessage(message.trim(), {
      photoUrl: imageUrl.trim() || undefined,
      buttonName: buttonName.trim() || undefined,
      buttonUrl: buttonUrl.trim() || undefined,
      sendToChannel: sendToChannel,
    });
    if (res.success) {
      setResult({ sent: res.sent, failed: res.failed });
      toast.success(`Broadcast sent to ${res.sent} users`);
      setMessage('');
      setImageUrl('');
      setButtonName('');
      setButtonUrl('');
      setSendToChannel(false);
      await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'broadcast', new_data: { message, sent: res.sent, sendToChannel } });
    } else {
      toast.error('Broadcast failed');
    }
    setSending(false);
  };

  return (
    <div className="space-y-3">
      <GlassCard className="p-4 space-y-3" animate={false}>
        <div className="flex items-center gap-2">
          <Send size={16} className="text-hive-gold" />
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Broadcast Message</p>
        </div>
        <p className="text-white/30 text-[10px]">Send a message to all users (including suspended) via bot.</p>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your announcement message here..."
          rows={5}
          className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30 resize-none"
        />

        {/* Image URL */}
        <div>
          <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Image URL (Optional)</label>
          <input
            type="text"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30"
          />
          {imageUrl && (
            <div className="mt-2 relative">
              <img src={imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; toast.error('Invalid image URL'); }} />
            </div>
          )}
        </div>

        {/* Button Name and URL */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Button Name</label>
            <input
              type="text"
              value={buttonName}
              onChange={e => setButtonName(e.target.value)}
              placeholder="e.g. Open App"
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30"
            />
          </div>
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Button URL</label>
            <input
              type="text"
              value={buttonUrl}
              onChange={e => setButtonUrl(e.target.value)}
              placeholder="https://t.me/..."
              className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30"
            />
          </div>
        </div>

        {/* Send to Channel toggle */}
        <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <input
            type="checkbox"
            id="sendToChannel"
            checked={sendToChannel}
            onChange={e => setSendToChannel(e.target.checked)}
            className="w-4 h-4 accent-hive-gold"
          />
          <div>
            <label htmlFor="sendToChannel" className="text-white/70 text-xs font-semibold cursor-pointer">
              Also send to community channel
            </label>
            <p className="text-white/30 text-[10px]">Message will be posted to @hiveearn</p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="w-full py-3 btn-hive rounded-xl font-bold text-sm disabled:opacity-40"
        >
          {sending ? 'Sending...' : '📢 Broadcast to All Users'}
        </motion.button>
        {result && (
          <div className="flex gap-2">
            <div className="flex-1 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <p className="text-green-400 text-lg font-bold">{result.sent}</p>
              <p className="text-green-400/60 text-[10px]">Sent</p>
            </div>
            <div className="flex-1 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
              <p className="text-red-400 text-lg font-bold">{result.failed}</p>
              <p className="text-red-400/60 text-[10px]">Failed</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Ad Providers ─────────────────────────────────────────────────────────────
function AdminAds({ adminId }: { adminId: string }) {
  const [providers, setProviders] = useState<Array<{ id: string; name: string; reward_per_ad: number; daily_limit: number; is_active: boolean; sort_order: number; block_id?: string; network_type?: string; min_watch_seconds?: number; sdk_zone?: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', reward_per_ad: '', daily_limit: '10', sort_order: '0', block_id: '', network_type: 'interstitial', min_watch_seconds: '15', sdk_zone: '' });

  const load = () => supabase.from('ad_providers').select('*').order('sort_order').then(({ data }) => setProviders(data ?? []));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.reward_per_ad) { toast.error('Name and Hive/ad required'); return; }
    const res = await createAdProvider(adminId, {
      name: form.name,
      reward_per_ad: parseFloat(form.reward_per_ad),
      daily_limit: parseInt(form.daily_limit) || 10,
      sort_order: parseInt(form.sort_order) || 0,
      block_id: form.block_id || undefined,
      network_type: form.network_type || 'interstitial',
      min_watch_seconds: parseInt(form.min_watch_seconds) || 15,
      sdk_zone: form.sdk_zone || undefined,
    });
    if (res.success) {
      toast.success('Ad provider created');
      setShowForm(false);
      setForm({ name: '', reward_per_ad: '', daily_limit: '10', sort_order: '0', block_id: '', network_type: 'interstitial', min_watch_seconds: '15', sdk_zone: '' });
      load();
    } else {
      toast.error(res.message);
    }
  };

  const handleUpdate = async (id: string) => {
    await updateAdProvider(id, {
      block_id: form.block_id || undefined,
      network_type: form.network_type || 'interstitial',
      min_watch_seconds: parseInt(form.min_watch_seconds) || 15,
      sdk_zone: form.sdk_zone || undefined,
    });
    toast.success('Provider updated');
    setEditingId(null);
    load();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await updateAdProvider(id, { is_active: !active });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ad provider?')) return;
    await deleteAdProvider(id);
    toast.success('Deleted');
    load();
  };

  return (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowForm(!showForm)} className="w-full flex items-center justify-center gap-2 py-3 btn-hive rounded-xl font-bold text-sm">
        <Plus size={16} /> {showForm ? 'Cancel' : 'Add Ad Provider'}
      </motion.button>

      {showForm && (
        <GlassCard className="p-4 space-y-3" animate={false}>
          {[
            { key: 'name', label: 'Provider Name *', placeholder: 'e.g. Adsgram', type: 'text' },
            { key: 'block_id', label: 'Block ID', placeholder: 'e.g. 36138 or int-36139', type: 'text' },
            { key: 'reward_per_ad', label: 'Hive per Ad *', placeholder: 'e.g. 8', type: 'number' },
            { key: 'daily_limit', label: 'Daily Limit', placeholder: 'e.g. 10', type: 'number' },
            { key: 'min_watch_seconds', label: 'Min Watch Seconds', placeholder: 'e.g. 15', type: 'number' },
            { key: 'sdk_zone', label: 'SDK Zone', placeholder: 'e.g. 11196790', type: 'text' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
              <input type={type} placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30" />
            </div>
          ))}
          <div>
            <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Network Type</label>
            <select value={form.network_type} onChange={e => setForm(f => ({ ...f, network_type: e.target.value }))} className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs focus:outline-none">
              <option value="interstitial">Interstitial</option>
              <option value="rewarded">Rewarded</option>
              <option value="banner">Banner</option>
            </select>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreate} className="w-full py-3 btn-hive rounded-xl font-bold text-sm">Create Provider</motion.button>
        </GlassCard>
      )}

      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
        {providers.length === 0 && <p className="text-white/30 text-xs text-center py-6">No ad providers</p>}
        {providers.map(p => (
          <div key={p.id} className="flex items-center gap-2 p-3">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${p.is_active ? 'text-white/80' : 'text-white/30 line-through'}`}>{p.name}</p>
              <p className="text-white/40 text-[10px]">{p.reward_per_ad} 🍯/ad • {p.daily_limit}/day {p.block_id && <span className="text-blue-400">• {p.block_id}</span>}</p>
              {p.min_watch_seconds && <p className="text-white/30 text-[9px]">Min watch: {p.min_watch_seconds}s • {p.network_type}</p>}
            </div>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggle(p.id, p.is_active)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${p.is_active ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/40'}`}>
              {p.is_active ? 'Active' : 'Off'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleDelete(p.id)} className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold">
              <Trash2 size={12} />
            </motion.button>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── Visit Sites ───────────────────────────────────────────────────────────────
function AdminVisitSites({ adminId }: { adminId: string }) {
  const [sites, setSites] = useState<Array<{ id: string; title: string; url: string; reward_hive: number; is_active: boolean; sort_order: number }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', reward_hive: '5', sort_order: '0' });

  const load = () => supabase.from('visit_websites').select('*').order('sort_order').then(({ data }) => setSites(data ?? []));
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.url) { toast.error('Title and URL required'); return; }
    await supabase.from('visit_websites').insert({
      title: form.title,
      url: form.url,
      reward_hive: parseFloat(form.reward_hive) || 5,
      min_watch_seconds: 15,
      sort_order: parseInt(form.sort_order) || 0,
      is_active: true,
    });
    toast.success('Website added');
    setShowForm(false);
    setForm({ title: '', url: '', reward_hive: '5', sort_order: '0' });
    load();
    await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'create_visit_site', new_data: { title: form.title, url: form.url } });
  };

  const handleToggle = async (site: typeof sites[0]) => {
    await supabase.from('visit_websites').update({ is_active: !site.is_active }).eq('id', site.id);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this website?')) return;
    await supabase.from('visit_websites').delete().eq('id', id);
    toast.success('Deleted');
    load();
  };

  return (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowForm(!showForm)} className="w-full flex items-center justify-center gap-2 py-3 btn-hive rounded-xl font-bold text-sm">
        <Plus size={16} /> {showForm ? 'Cancel' : 'Add Website'}
      </motion.button>

      {showForm && (
        <GlassCard className="p-4 space-y-3" animate={false}>
          {[
            { key: 'title', label: 'Website Title *', placeholder: 'e.g. Partner Site' },
            { key: 'url', label: 'Website URL *', placeholder: 'https://...' },
            { key: 'reward_hive', label: 'Reward (Hive)', placeholder: 'e.g. 5', type: 'number' },
            { key: 'sort_order', label: 'Sort Order', placeholder: 'e.g. 0', type: 'number' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
              <input type={type ?? 'text'} placeholder={placeholder} value={form[key as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30" />
            </div>
          ))}
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleCreate} className="w-full py-3 btn-hive rounded-xl font-bold text-sm">Add Website</motion.button>
        </GlassCard>
      )}

      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
        {sites.length === 0 && <p className="text-white/30 text-xs text-center py-6">No websites</p>}
        {sites.map(s => (
          <div key={s.id} className="flex items-center gap-2 p-3">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${s.is_active ? 'text-white/80' : 'text-white/30 line-through'}`}>{s.title}</p>
              <p className="text-white/40 text-[10px] truncate">{s.url}</p>
              <p className="text-hive-gold text-[10px]">+{s.reward_hive} Hive per visit</p>
            </div>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggle(s)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${s.is_active ? 'bg-green-500/15 text-green-400' : 'bg-white/[0.06] text-white/40'}`}>
              {s.is_active ? 'Active' : 'Off'}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleDelete(s.id)} className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-[10px] font-bold">
              <Trash2 size={12} />
            </motion.button>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── App Settings ─────────────────────────────────────────────────────────────
function AdminSettings({ adminId }: { adminId: string }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const load = async () => {
    const s = await getAppSettings();
    setSettings(s);
    setMaintenanceMode(s.maintenance_mode === 'true');
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editKey.trim()) { toast.error('Key required'); return; }
    await updateAppSetting(editKey.trim(), editValue.trim());
    toast.success('Setting saved');
    setEditKey(''); setEditValue('');
    load();
    await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'update_setting', new_data: { key: editKey, value: editValue } });
  };

  const handleToggleMaintenance = async () => {
    const newValue = !maintenanceMode;
    await updateAppSetting('maintenance_mode', newValue ? 'true' : 'false');
    setMaintenanceMode(newValue);
    toast.success(newValue ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
    await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'toggle_maintenance', new_data: { enabled: newValue } });
  };

  const knownSettings = [
    { key: 'hive_to_usdt', label: 'HIVE → USDT Rate', placeholder: 'e.g. 0.001' },
    { key: 'min_withdrawal_usdt', label: 'Min Withdrawal (USDT)', placeholder: 'e.g. 0.08' },
    { key: 'referral_reward', label: 'Referral Reward (Hive)', placeholder: 'e.g. 25' },
    { key: 'daily_bonus', label: 'Daily Bonus (Hive)', placeholder: 'e.g. 10' },
    { key: 'required_daily_ads', label: 'Required Daily Ads for Withdraw', placeholder: 'e.g. 20' },
    { key: 'required_referrals', label: 'Required Referrals for Withdraw', placeholder: 'e.g. 2' },
    { key: 'required_main_tasks', label: 'Required Main Tasks for Withdraw', placeholder: 'e.g. 2' },
    { key: 'withdraw_ad_count', label: 'Ads Before Withdrawal', placeholder: 'e.g. 2' },
    { key: 'visit_site_reward', label: 'Visit Site Reward (Hive)', placeholder: 'e.g. 5' },
    { key: 'visit_site_min_seconds', label: 'Visit Site Min Seconds', placeholder: 'e.g. 15' },
  ];

  return (
    <div className="space-y-3">
      {/* Maintenance Mode */}
      <GlassCard className={`p-4 ${maintenanceMode ? 'border-red-500/30 bg-red-500/5' : ''}`} animate={false}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${maintenanceMode ? 'bg-red-500/15' : 'bg-white/[0.06]'}`}>
              <Wrench size={18} className={maintenanceMode ? 'text-red-400' : 'text-white/30'} />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Maintenance Mode</p>
              <p className={`text-[10px] ${maintenanceMode ? 'text-red-400' : 'text-white/40'}`}>
                {maintenanceMode ? 'App is disabled for users' : 'App is running normally'}
              </p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleToggleMaintenance}
            className={`px-4 py-2 rounded-xl font-bold text-xs ${maintenanceMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/[0.06] text-white/60 border border-white/10'}`}
          >
            {maintenanceMode ? 'Disable' : 'Enable'}
          </motion.button>
        </div>
      </GlassCard>

      <GlassCard className="p-4 space-y-3" animate={false}>
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-hive-gold" />
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">App Settings</p>
        </div>

        {/* Known settings */}
        {knownSettings.map(({ key, label, placeholder }) => (
          <div key={key} className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
              <input
                type="text"
                placeholder={placeholder}
                defaultValue={settings[key] ?? ''}
                onBlur={e => { if (e.target.value !== (settings[key] ?? '')) { updateAppSetting(key, e.target.value).then(() => { toast.success(`${label} updated`); load(); }); } }}
                className="w-full px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none focus:border-hive-gold/30"
              />
            </div>
          </div>
        ))}

        {/* Custom setting */}
        <div className="pt-2 border-t border-white/[0.06]">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Add Custom Setting</p>
          <div className="flex gap-2">
            <input value={editKey} onChange={e => setEditKey(e.target.value)} placeholder="key" className="flex-1 px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none" />
            <input value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="value" className="flex-1 px-3 py-2.5 bg-white/[0.06] border border-white/[0.08] rounded-xl text-white text-xs placeholder:text-white/20 focus:outline-none" />
            <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} className="px-4 py-2.5 btn-hive rounded-xl text-xs font-bold">Save</motion.button>
          </div>
        </div>
      </GlassCard>

      {/* All settings list */}
      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
        {Object.entries(settings).length === 0 && <p className="text-white/30 text-xs text-center py-4">No settings</p>}
        {Object.entries(settings).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-3">
            <p className="text-white/60 text-xs font-mono">{key}</p>
            <p className="text-hive-gold text-xs font-mono">{value}</p>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ─── Admin Logs ───────────────────────────────────────────────────────────────
function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);

  useEffect(() => { supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(50).then(({ data }) => setLogs(data ?? [])); }, []);

  return (
    <div>
      <GlassCard className="divide-y divide-white/[0.04] overflow-hidden" animate={false}>
        {logs.length === 0 && <p className="text-white/30 text-xs text-center py-6">No admin logs yet</p>}
        {logs.map(log => (
          <div key={log.id} className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-white/70 text-xs font-semibold">{log.action.replace('_', ' ')}</p>
              <p className="text-white/20 text-[9px]">{timeAgo(log.created_at)}</p>
            </div>
            {log.target_type && <p className="text-white/30 text-[10px]">{log.target_type}</p>}
          </div>
        ))}
      </GlassCard>
    </div>
  );
}
