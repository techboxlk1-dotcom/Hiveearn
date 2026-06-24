import { supabase } from './supabase';
import type { User, Transaction, Withdrawal, RewardCode, Task, Referral, Notification, Announcement, AdProvider, AdWatch } from './supabase';
import { generateReferralCode, isValidBep20Address, HIVE_TO_USDT } from './utils';

// ─── User ────────────────────────────────────────────────────────────────────

export async function upsertUser(telegramData: {
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  referral_code_used?: string;
}): Promise<User | null> {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramData.telegram_id)
    .maybeSingle();

  if (existing) {
    const { data } = await supabase
      .from('users')
      .update({
        username: telegramData.username,
        first_name: telegramData.first_name,
        last_name: telegramData.last_name,
        photo_url: telegramData.photo_url,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_id', telegramData.telegram_id)
      .select()
      .maybeSingle();
    return data;
  }

  const referralCode = generateReferralCode(telegramData.telegram_id);
  let referredBy: string | null = null;

  if (telegramData.referral_code_used) {
    const { data: referrer } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', telegramData.referral_code_used)
      .maybeSingle();
    if (referrer) referredBy = referrer.id;
  }

  const { data: newUser } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramData.telegram_id,
      username: telegramData.username ?? null,
      first_name: telegramData.first_name,
      last_name: telegramData.last_name ?? null,
      photo_url: telegramData.photo_url ?? null,
      referral_code: referralCode,
      referred_by: referredBy,
      hive_balance: 0,
    })
    .select()
    .maybeSingle();

  if (newUser && referredBy) {
    const deadline = new Date();
    deadline.setHours(deadline.getHours() + 48);
    await supabase.from('referrals').insert({
      referrer_id: referredBy,
      referred_id: newUser.id,
      status: 'pending',
      deadline_at: deadline.toISOString(),
    });
    await creditHive(referredBy, 25, 'referral', 'New referral joined');
    await createNotification(referredBy, 'referral', 'New Referral!', `Someone joined using your referral link. +25 Hive earned!`);
  }

  return newUser;
}

export async function getUserByTelegramId(telegramId: number): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  return data;
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export async function creditHive(
  userId: string,
  amount: number,
  type: Transaction['type'],
  description: string,
  referenceId?: string
): Promise<void> {
  const { data: user } = await supabase.from('users').select('hive_balance').eq('id', userId).maybeSingle();
  if (!user) return;

  await supabase.from('users').update({ hive_balance: user.hive_balance + amount }).eq('id', userId);
  await supabase.from('transactions').insert({
    user_id: userId,
    type,
    amount,
    description,
    reference_id: referenceId ?? null,
    status: 'completed',
  });
}

export async function debitHive(userId: string, amount: number, type: Transaction['type'], description: string): Promise<boolean> {
  const { data: user } = await supabase.from('users').select('hive_balance').eq('id', userId).maybeSingle();
  if (!user || user.hive_balance < amount) return false;

  await supabase.from('users').update({ hive_balance: user.hive_balance - amount }).eq('id', userId);
  await supabase.from('transactions').insert({
    user_id: userId,
    type,
    amount: -amount,
    description,
    status: 'completed',
  });
  return true;
}

// ─── Daily Bonus ─────────────────────────────────────────────────────────────

export async function claimDailyBonus(userId: string): Promise<{ success: boolean; hive: number; message: string }> {
  const { data: lastClaim } = await supabase
    .from('daily_bonus_claims')
    .select('claimed_at')
    .eq('user_id', userId)
    .order('claimed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastClaim) {
    const last = new Date(lastClaim.claimed_at);
    const now = new Date();
    const diffHours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
    if (diffHours < 24) {
      const remaining = Math.ceil(24 - diffHours);
      return { success: false, hive: 0, message: `Come back in ${remaining}h` };
    }
  }

  const { count } = await supabase.from('daily_bonus_claims').select('*', { count: 'exact', head: true }).eq('user_id', userId);
  const streakDay = (count ?? 0) + 1;

  await supabase.from('daily_bonus_claims').insert({ user_id: userId, hive_earned: 10, streak_day: streakDay });
  await creditHive(userId, 10, 'daily_bonus', `Daily bonus - Day ${streakDay}`);
  await createNotification(userId, 'daily_bonus', 'Daily Bonus Claimed!', `You earned 10 Hive! Come back tomorrow for more.`);

  return { success: true, hive: 10, message: 'Daily bonus claimed!' };
}

// ─── Reward Codes ─────────────────────────────────────────────────────────────

export async function claimRewardCode(userId: string, code: string): Promise<{ success: boolean; hive: number; message: string }> {
  const { data: rc } = await supabase
    .from('reward_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (!rc) return { success: false, hive: 0, message: 'Invalid reward code' };
  if (!rc.is_active) return { success: false, hive: 0, message: 'This code is no longer active' };
  if (rc.expires_at && new Date(rc.expires_at) < new Date()) return { success: false, hive: 0, message: 'Code has expired' };
  if (rc.usage_limit !== null && rc.usage_count >= rc.usage_limit) return { success: false, hive: 0, message: 'Code usage limit reached' };

  const { data: existing } = await supabase
    .from('reward_code_claims')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_code_id', rc.id)
    .maybeSingle();

  if (existing) return { success: false, hive: 0, message: 'You already claimed this code' };

  await supabase.from('reward_code_claims').insert({ user_id: userId, reward_code_id: rc.id, hive_earned: rc.reward_amount });
  await supabase.from('reward_codes').update({ usage_count: rc.usage_count + 1 }).eq('id', rc.id);
  await creditHive(userId, rc.reward_amount, 'reward_code', `Reward code: ${code.toUpperCase()}`);
  await createNotification(userId, 'reward_code', 'Reward Code Claimed!', `You earned ${rc.reward_amount} Hive!`);

  return { success: true, hive: rc.reward_amount, message: `+${rc.reward_amount} Hive earned!` };
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export async function getAdProviders(): Promise<AdProvider[]> {
  const { data } = await supabase.from('ad_providers').select('*').eq('is_active', true).order('sort_order');
  return data ?? [];
}

export async function getTodayAdCount(userId: string, providerId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('ad_watches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .eq('completed', true)
    .gte('watched_at', today.toISOString());
  return count ?? 0;
}

export async function recordAdWatch(userId: string, providerId: string, hiveEarned: number): Promise<{ success: boolean; message: string }> {
  const { data: provider } = await supabase.from('ad_providers').select('*').eq('id', providerId).maybeSingle();
  if (!provider) return { success: false, message: 'Provider not found' };

  const todayCount = await getTodayAdCount(userId, providerId);
  if (todayCount >= provider.daily_limit) return { success: false, message: `Daily limit of ${provider.daily_limit} ads reached` };

  await supabase.from('ad_watches').insert({ user_id: userId, provider_id: providerId, hive_earned: hiveEarned, completed: true });
  await creditHive(userId, hiveEarned, 'ad', `Ad watched - ${provider.name}`);

  // Check referral milestones
  await checkReferralAdMilestones(userId);

  return { success: true, message: `+${hiveEarned} Hive earned!` };
}

async function checkReferralAdMilestones(userId: string): Promise<void> {
  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_id', userId)
    .maybeSingle();

  if (!referral || referral.status === 'fake' || referral.status === 'blocked') return;

  const today = new Date();
  const joinDate = new Date(referral.created_at);
  const daysSinceJoin = Math.floor((today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));

  if (!referral.first_ads_reward_paid) {
    const { count: totalAds } = await supabase.from('ad_watches').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', true);
    if ((totalAds ?? 0) >= 10) {
      await supabase.from('referrals').update({ first_ads_reward_paid: true }).eq('id', referral.id);
      await creditHive(referral.referrer_id, 50, 'referral', 'Referral watched first 10 ads');
      await createNotification(referral.referrer_id, 'referral', 'Referral Milestone!', `Your referral watched their first 10 ads. +50 Hive!`);
    }
  }

  if (!referral.second_day_reward_paid && daysSinceJoin >= 1) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const { count: day2Ads } = await supabase
      .from('ad_watches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('watched_at', yesterday.toISOString())
      .lte('watched_at', yesterdayEnd.toISOString());

    if ((day2Ads ?? 0) >= 10) {
      await supabase.from('referrals').update({ second_day_reward_paid: true, status: 'completed', completed_at: new Date().toISOString() }).eq('id', referral.id);
      await creditHive(referral.referrer_id, 75, 'referral', 'Referral completed day 2 ads');
      await createNotification(referral.referrer_id, 'referral_completed', 'Referral Completed!', `Your referral completed all milestones. +75 Hive!`);
    }
  }
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function getTasks(category?: string): Promise<Task[]> {
  let query = supabase.from('tasks').select('*').eq('is_active', true).order('sort_order');
  if (category) query = query.eq('category', category);
  const { data } = await query;
  return data ?? [];
}

export async function getUserTaskCompletions(userId: string): Promise<Record<string, string>> {
  const { data } = await supabase.from('task_completions').select('task_id, status').eq('user_id', userId);
  const map: Record<string, string> = {};
  (data ?? []).forEach(tc => { map[tc.task_id] = tc.status; });
  return map;
}

export async function startTask(userId: string, taskId: string): Promise<{ success: boolean; message: string }> {
  const { data: existing } = await supabase.from('task_completions').select('id').eq('user_id', userId).eq('task_id', taskId).maybeSingle();
  if (existing) return { success: false, message: 'Task already started or completed' };

  await supabase.from('task_completions').insert({ user_id: userId, task_id: taskId, status: 'pending' });
  return { success: true, message: 'Task started - verify to earn reward' };
}

export async function verifyTask(userId: string, taskId: string): Promise<{ success: boolean; hive: number; message: string }> {
  const { data: tc } = await supabase.from('task_completions').select('*').eq('user_id', userId).eq('task_id', taskId).maybeSingle();
  if (!tc) return { success: false, hive: 0, message: 'Please start the task first' };
  if (tc.status === 'verified') return { success: false, hive: 0, message: 'Task already completed' };

  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { success: false, hive: 0, message: 'Task not found' };

  await supabase.from('task_completions').update({ status: 'verified', hive_earned: task.reward_amount, verified_at: new Date().toISOString() }).eq('user_id', userId).eq('task_id', taskId);
  await creditHive(userId, task.reward_amount, 'task', `Task completed: ${task.title}`);
  await createNotification(userId, 'task_completed', 'Task Completed!', `You earned ${task.reward_amount} Hive for completing "${task.title}"`);

  return { success: true, hive: task.reward_amount, message: `+${task.reward_amount} Hive earned!` };
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function setWallet(userId: string, address: string): Promise<{ success: boolean; message: string }> {
  if (!isValidBep20Address(address)) return { success: false, message: 'Invalid BEP20 address' };

  const { data: existing } = await supabase.from('wallets').select('id').eq('user_id', userId).maybeSingle();
  if (existing) {
    await supabase.from('wallets').update({ address, updated_at: new Date().toISOString() }).eq('user_id', userId);
  } else {
    await supabase.from('wallets').insert({ user_id: userId, address, network: 'BEP20' });
  }
  return { success: true, message: 'Wallet saved successfully' };
}

export async function getWallet(userId: string) {
  const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

// ─── Withdrawals ──────────────────────────────────────────────────────────────

export async function requestWithdrawal(userId: string, hiveAmount: number): Promise<{ success: boolean; message: string }> {
  const wallet = await getWallet(userId);
  if (!wallet) return { success: false, message: 'Please set a wallet address first' };

  const { data: user } = await supabase.from('users').select('hive_balance').eq('id', userId).maybeSingle();
  if (!user || user.hive_balance < hiveAmount) return { success: false, message: 'Insufficient balance' };

  const usdtAmount = hiveAmount * HIVE_TO_USDT;
  const feeFixed = 0.01;
  const feePercent = usdtAmount * 0.05;
  const totalFee = feeFixed + feePercent;
  const netAmount = usdtAmount - totalFee;

  if (usdtAmount < 0.08) return { success: false, message: 'Minimum withdrawal is 0.08 USDT' };
  if (netAmount <= 0) return { success: false, message: 'Amount too small after fees' };

  const deducted = await debitHive(userId, hiveAmount, 'withdraw', `Withdrawal request`);
  if (!deducted) return { success: false, message: 'Failed to deduct balance' };

  await supabase.from('withdrawals').insert({
    user_id: userId,
    wallet_address: wallet.address,
    hive_amount: hiveAmount,
    usdt_amount: usdtAmount,
    fee_amount: totalFee,
    net_amount: netAmount,
    status: 'pending',
  });

  await createNotification(userId, 'withdraw_pending', 'Withdrawal Requested', `Your withdrawal of ${netAmount.toFixed(6)} USDT is pending admin approval.`);

  return { success: true, message: 'Withdrawal request submitted' };
}

export async function getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
  const { data } = await supabase.from('withdrawals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return data ?? [];
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getUserTransactions(userId: string, type?: string, limit = 20, offset = 0): Promise<Transaction[]> {
  let query = supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (type) query = query.eq('type', type);
  const { data } = await query;
  return data ?? [];
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(userId: string, type: string, title: string, message: string, data?: Record<string, unknown>): Promise<void> {
  await supabase.from('notifications').insert({ user_id: userId, type, title, message, data: data ?? null });
}

export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  return data ?? [];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data } = await supabase.from('announcements').select('*').eq('is_active', true).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10);
  return data ?? [];
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export async function getTopEarners(period: 'weekly' | 'monthly' | 'all'): Promise<Array<User & { rank: number }>> {
  const { data } = await supabase.from('users').select('*').order('hive_balance', { ascending: false }).limit(50);
  return (data ?? []).map((u, i) => ({ ...u, rank: i + 1 }));
}

export async function getTopReferrers(): Promise<Array<{ user: User; count: number; rank: number }>> {
  const { data: referrals } = await supabase.from('referrals').select('referrer_id').eq('status', 'completed');
  const counts: Record<string, number> = {};
  (referrals ?? []).forEach(r => { counts[r.referrer_id] = (counts[r.referrer_id] ?? 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 50);
  const results = await Promise.all(
    sorted.map(async ([userId, count], i) => {
      const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      return { user: user!, count, rank: i + 1 };
    })
  );
  return results.filter(r => r.user);
}

export async function getTopAdWatchers(): Promise<Array<{ user: User; count: number; rank: number }>> {
  const { data: watches } = await supabase.from('ad_watches').select('user_id').eq('completed', true);
  const counts: Record<string, number> = {};
  (watches ?? []).forEach(w => { counts[w.user_id] = (counts[w.user_id] ?? 0) + 1; });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 50);
  const results = await Promise.all(
    sorted.map(async ([userId, count], i) => {
      const { data: user } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      return { user: user!, count, rank: i + 1 };
    })
  );
  return results.filter(r => r.user);
}

// ─── Referral ────────────────────────────────────────────────────────────────

export async function getUserReferrals(userId: string): Promise<Referral[]> {
  const { data } = await supabase.from('referrals').select('*').eq('referrer_id', userId).order('created_at', { ascending: false });
  return data ?? [];
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function getAllUsers(search?: string, limit = 20, offset = 0): Promise<User[]> {
  let query = supabase.from('users').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (search) query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%`);
  const { data } = await query;
  return data ?? [];
}

export async function suspendUser(adminId: string, userId: string, reason: string): Promise<void> {
  await supabase.from('users').update({ is_suspended: true, suspension_reason: reason }).eq('id', userId);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'suspend_user', target_type: 'user', target_id: userId, new_data: { reason } });
  await createNotification(userId, 'suspended', 'Account Suspended', `Your account has been suspended. Reason: ${reason}`);
}

export async function unsuspendUser(adminId: string, userId: string): Promise<void> {
  await supabase.from('users').update({ is_suspended: false, suspension_reason: null }).eq('id', userId);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'unsuspend_user', target_type: 'user', target_id: userId });
}

export async function approveWithdrawal(adminId: string, withdrawalId: string, txid: string): Promise<void> {
  const { data: wd } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).maybeSingle();
  if (!wd) return;

  await supabase.from('withdrawals').update({ status: 'approved', txid, reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq('id', withdrawalId);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'approve_withdrawal', target_type: 'withdrawal', target_id: withdrawalId, new_data: { txid } });
  await createNotification(wd.user_id, 'withdraw_approved', 'Withdrawal Approved!', `Your withdrawal has been approved. TXID: ${txid}`, { txid, amount: wd.net_amount });
}

export async function rejectWithdrawal(adminId: string, withdrawalId: string, reason: string): Promise<void> {
  const { data: wd } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).maybeSingle();
  if (!wd) return;

  await supabase.from('withdrawals').update({ status: 'rejected', admin_note: reason, reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq('id', withdrawalId);
  await creditHive(wd.user_id, wd.hive_amount, 'adjustment', `Withdrawal rejected - refunded`);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'reject_withdrawal', target_type: 'withdrawal', target_id: withdrawalId, new_data: { reason } });
  await createNotification(wd.user_id, 'withdraw_rejected', 'Withdrawal Rejected', `Your withdrawal was rejected. Reason: ${reason}. Funds returned to your balance.`);
}

export async function createRewardCode(adminId: string, code: string, reward: number, limit?: number, expiresAt?: string, description?: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('reward_codes').insert({
    code: code.toUpperCase(),
    reward_amount: reward,
    usage_limit: limit ?? null,
    expires_at: expiresAt ?? null,
    created_by: adminId,
    description: description ?? null,
  });
  if (error) return { success: false, message: error.message };
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'create_reward_code', target_type: 'reward_code', new_data: { code, reward } });
  return { success: true, message: 'Reward code created' };
}

export async function createAnnouncement(adminId: string, title: string, content: string, type: string, pinned = false): Promise<void> {
  await supabase.from('announcements').insert({ title, content, type, pinned, created_by: adminId });
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'create_announcement', new_data: { title, type } });
}

export async function createTask(adminId: string, task: Partial<import('./supabase').Task>): Promise<void> {
  await supabase.from('tasks').insert(task);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'create_task', new_data: task });
}

export async function getAdminStats() {
  const [{ count: totalUsers }, { count: pendingWithdrawals }, { count: totalTasks }, { data: settings }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }),
    supabase.from('app_settings').select('*'),
  ]);
  return { totalUsers: totalUsers ?? 0, pendingWithdrawals: pendingWithdrawals ?? 0, totalTasks: totalTasks ?? 0, settings: settings ?? [] };
}
