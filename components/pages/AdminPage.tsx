'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, DollarSign, CheckSquare, Megaphone, Gift, Shield, BarChart2, Plus, Check, X, Search, Trash2, Eye, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import GlassCard from '@/components/ui/GlassCard';
import { supabase } from '@/lib/supabase';
import type { User, Withdrawal, RewardCode, Task, Announcement, FraudLog, AdminLog } from '@/lib/supabase';
import { getAllUsers, approveWithdrawal, rejectWithdrawal, createRewardCode, suspendUser, unsuspendUser, createAnnouncement, createTask, getAdminStats, blockIp } from '@/lib/api';
import { formatHive, formatUsdt, hiveToUsdt, timeAgo, truncateAddress } from '@/lib/utils';
import { toast } from 'sonner';

type AdminSection = 'dashboard' | 'users' | 'withdrawals' | 'reward_codes' | 'tasks' | 'announcements' | 'fraud' | 'logs';

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
  const [dbStats, setDbStats] = useState({ totalHive: 0, totalWithdrawals: 0, todayUsers: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('hive_balance'),
      supabase.from('withdrawals').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 86400000).toISOString()),
    ]).then(([{ data: users }, { count: wdCount }, { count: todayCount }]) => {
      setDbStats({
        totalHive: (users ?? []).reduce((sum, u) => sum + (u.hive_balance ?? 0), 0),
        totalWithdrawals: wdCount ?? 0,
        todayUsers: todayCount ?? 0,
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
      <GlassCard className="p-4" animate={false}>
        <h3 className="text-white/60 font-semibold text-sm mb-3">Quick Stats</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-white/40">Total Withdrawals</span><span className="text-white/70 font-bold">{dbStats.totalWithdrawals}</span></div>
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
                <p className="text-hive-gold text-[10px]">{formatHive(u.hive_balance)} H {u.is_admin && <span className="text-red-400">• Admin</span>}</p>
              </div>
              <motion.button whileTap={{ scale: 0.85 }} onClick={() => handleToggleSuspend(u)} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${u.is_suspended ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                {u.is_suspended ? 'Unsuspend' : 'Suspend'}
              </motion.button>
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

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('withdrawals').select('*, users(*)').eq('status', filter).order('created_at', { ascending: false }).limit(30);
    setWithdrawals((data as Array<Withdrawal & { users: User | null }>) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleApprove = async (wd: Withdrawal) => {
    const txid = prompt('Enter TXID:');
    if (!txid) return;
    await approveWithdrawal(adminId, wd.id, txid);
    toast.success('Withdrawal approved');
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
                  <p className="text-white/30 text-[10px]">{timeAgo(wd.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-hive-gold font-black">{formatUsdt(wd.net_amount)} USDT</p>
                  <p className="text-white/40 text-[10px]">{formatHive(wd.hive_amount)} H</p>
                  <p className={`text-[10px] font-bold capitalize ${statusColor[wd.status]}`}>{wd.status}</p>
                </div>
              </div>
              {wd.status === 'pending' && (
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleApprove(wd)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/15 border border-green-500/20 rounded-xl text-green-400 text-xs font-bold">
                    <Check size={12} /> Approve
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleReject(wd)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-500/15 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold">
                    <X size={12} /> Reject
                  </motion.button>
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
