import { supabase } from './supabase';
import type { User, Transaction, Withdrawal, RewardCode, Task, Referral, Notification, Announcement, AdProvider } from './supabase';
import { generateReferralCode, isValidBep20Address, HIVE_TO_USDT } from './utils';

const MINI_APP_URL = 'https://t.me/Hiveearnbot/play';
const BOT_TOKEN = '8969456125:AAFm5CQIhVWpTL6XQDhj-YoVDEojprQWHo4';
const ADMIN_CHAT_ID = '5419054691';

// ─── Telegram Bot Notification ────────────────────────────────────────────────

export async function sendBotMessage(chatId: string | number, text: string, includeAppButton = true): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    };

    if (includeAppButton) {
      payload.reply_markup = {
        inline_keyboard: [[
          {
            text: '🐝 Open Hive Earn',
            web_app: { url: MINI_APP_URL },
          },
        ]],
      };
    }

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Bot notification failure should never block main app logic
  }
}

async function notifyAdmin(text: string): Promise<void> {
  await sendBotMessage(ADMIN_CHAT_ID, text, false);
}

// ─── IP / Fraud Helpers ───────────────────────────────────────────────────────

export async function detectAndHandleIpAbuse(userId: string, ipAddress: string): Promise<void> {
  if (!ipAddress || ipAddress === 'unknown') return;

  // Check if IP is in block list
  const { data: blocked } = await supabase.from('ip_blocks').select('id').eq('ip_address', ipAddress).maybeSingle();
  if (blocked) {
    await autoSuspendUser(userId, `IP address ${ipAddress} is blocked`);
    return;
  }

  // Find all non-admin accounts on same IP (excluding current user)
  const { data: sameIpUsers } = await supabase
    .from('users')
    .select('id, telegram_id, first_name, is_suspended, is_admin')
    .eq('ip_address', ipAddress)
    .neq('id', userId);

  if (!sameIpUsers || sameIpUsers.length === 0) return;

  // Only flag if more than 1 extra account on same IP (allow family/shared network with 1)
  if (sameIpUsers.length >= 2) {
    // Mark ip_flagged for all accounts on this IP
    await supabase.from('users').update({ ip_flagged: true }).eq('ip_address', ipAddress);

    // Auto-suspend current user if not admin
    const { data: currentUser } = await supabase.from('users').select('is_admin, is_suspended').eq('id', userId).maybeSingle();
    if (currentUser && !currentUser.is_admin && !currentUser.is_suspended) {
      await autoSuspendUser(userId, `Multiple accounts detected from same IP (${ipAddress})`);

      // Log fraud
      await supabase.from('fraud_logs').insert({
        user_id: userId,
        type: 'multiple_accounts',
        description: `Auto-suspended: ${sameIpUsers.length + 1} accounts on IP ${ipAddress}`,
        ip_address: ipAddress,
        severity: 'high',
      });

      await notifyAdmin(
        `🚨 <b>Fraud Detected</b>\n\nMultiple accounts on same IP: <code>${ipAddress}</code>\nAccounts: ${sameIpUsers.length + 1}\nAuto-suspended new account.`
      );
    }
  }
}

async function autoSuspendUser(userId: string, reason: string): Promise<void> {
  const { data: user } = await supabase.from('users').select('is_admin, is_suspended, telegram_id, first_name').eq('id', userId).maybeSingle();
  if (!user || user.is_admin || user.is_suspended) return;

  await supabase.from('users').update({ is_suspended: true, suspension_reason: reason }).eq('id', userId);
  await createNotification(userId, 'suspended', 'Account Suspended', `Your account has been automatically suspended. Reason: ${reason}`);
  await sendBotMessage(
    user.telegram_id,
    `🚫 <b>Account Suspended</b>\n\nYour Hive Earn account has been suspended.\n\n<b>Reason:</b> ${reason}\n\nContact support if you believe this is a mistake.`,
    false
  );
}

export async function isIpBlockedForReferral(ipAddress: string): Promise<boolean> {
  if (!ipAddress || ipAddress === 'unknown') return false;
  const { data } = await supabase.from('ip_blocks').select('id').eq('ip_address', ipAddress).maybeSingle();
  return !!data;
}

export async function blockIp(adminId: string, ipAddress: string, reason: string): Promise<void> {
  await supabase.from('ip_blocks').upsert({ ip_address: ipAddress, reason, blocked_by: adminId });
  // Suspend all non-admin users on this IP
  const { data: users } = await supabase.from('users').select('id, is_admin').eq('ip_address', ipAddress);
  for (const u of users ?? []) {
    if (!u.is_admin) await autoSuspendUser(u.id, `IP blocked by admin: ${reason}`);
  }
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'block_ip', new_data: { ip_address: ipAddress, reason } });
}

// ─── Suspension Guard ─────────────────────────────────────────────────────────

async function checkNotSuspended(userId: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await supabase.from('users').select('is_suspended, suspension_reason').eq('id', userId).maybeSingle();
  if (data?.is_suspended) {
    return { ok: false, message: `Your account is suspended. Reason: ${data.suspension_reason ?? 'Policy violation'}` };
  }
  return { ok: true, message: '' };
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function upsertUser(telegramData: {
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  referral_code_used?: string;
  ip_address?: string;
}): Promise<User | null> {
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramData.telegram_id)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, unknown> = {
      username: telegramData.username,
      first_name: telegramData.first_name,
      last_name: telegramData.last_name,
      photo_url: telegramData.photo_url,
      updated_at: new Date().toISOString(),
    };
    if (telegramData.ip_address) updates.ip_address = telegramData.ip_address;

    const { data } = await supabase
      .from('users')
      .update(updates)
      .eq('telegram_id', telegramData.telegram_id)
      .select()
      .maybeSingle();

    // Run IP abuse check on every login
    if (data && telegramData.ip_address && !data.is_admin) {
      detectAndHandleIpAbuse(data.id, telegramData.ip_address);
    }
    return data;
  }

  // New user registration
  const referralCode = generateReferralCode(telegramData.telegram_id);
  let referredBy: string | null = null;
  let referrerIp: string | null = null;

  if (telegramData.referral_code_used) {
    const { data: referrer } = await supabase
      .from('users')
      .select('id, ip_address')
      .eq('referral_code', telegramData.referral_code_used)
      .maybeSingle();
    if (referrer) {
      referredBy = referrer.id;
      referrerIp = referrer.ip_address ?? null;
    }
  }

  // Block same-IP referral fraud
  const sameIpReferral = telegramData.ip_address && referrerIp && telegramData.ip_address === referrerIp;

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
      ip_address: telegramData.ip_address ?? null,
      hive_balance: 0,
    })
    .select()
    .maybeSingle();

  if (newUser) {
    // Notify admin of new user via bot
    await notifyAdmin(
      `👤 <b>New User Joined</b>\n\nName: ${newUser.first_name}${newUser.username ? ` (@${newUser.username})` : ''}\nTelegram ID: <code>${newUser.telegram_id}</code>${telegramData.ip_address ? `\nIP: <code>${telegramData.ip_address}</code>` : ''}${referredBy ? '\nVia referral link' : ''}`
    );

    if (referredBy && !sameIpReferral) {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 48);
      await supabase.from('referrals').insert({
        referrer_id: referredBy,
        referred_id: newUser.id,
        status: 'pending',
        deadline_at: deadline.toISOString(),
      });
      await creditHive(referredBy, 25, 'referral', '🍯 New referral joined');
      await createNotification(referredBy, 'referral', '🐝 New Referral!', `Someone joined using your referral link. +25 🍯 Hive earned!`);
      // Notify referrer via bot
      const { data: referrerUser } = await supabase.from('users').select('telegram_id').eq('id', referredBy).maybeSingle();
      if (referrerUser) {
        await sendBotMessage(
          referrerUser.telegram_id,
          `🐝 <b>New Referral Joined!</b>\n\n${newUser.first_name} joined using your referral link.\n\n💰 You earned <b>+25 🍯 Hive</b>!\n\nThey need to watch ads to unlock more rewards for you.`
        );
      }
    } else if (referredBy && sameIpReferral) {
      // Same-IP referral — mark as fake immediately
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 48);
      await supabase.from('referrals').insert({
        referrer_id: referredBy,
        referred_id: newUser.id,
        status: 'fake',
        fake_reason: 'Same IP address as referrer',
        deadline_at: deadline.toISOString(),
      });
      await supabase.from('fraud_logs').insert({
        user_id: newUser.id,
        type: 'referral_abuse',
        description: `Same-IP referral: new user and referrer share IP ${telegramData.ip_address}`,
        ip_address: telegramData.ip_address,
        severity: 'high',
      });
      await notifyAdmin(
        `🚨 <b>Same-IP Referral Blocked</b>\n\nNew user ${newUser.first_name} and referrer share IP <code>${telegramData.ip_address}</code>.\nReferral marked as fake. No reward issued.`
      );
    }

    // Run IP abuse check for new user too
    if (telegramData.ip_address && !newUser.is_admin) {
      detectAndHandleIpAbuse(newUser.id, telegramData.ip_address);
    }
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
  const guard = await checkNotSuspended(userId);
  if (!guard.ok) return { success: false, hive: 0, message: guard.message };

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
  await creditHive(userId, 10, 'daily_bonus', `🎁 Daily bonus - Day ${streakDay}`);
  await createNotification(userId, 'daily_bonus', '🎁 Daily Bonus Claimed!', `You earned 10 🍯 Hive! Come back tomorrow for more.`);

  // Notify via bot
  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle();
  if (user) {
    await sendBotMessage(
      user.telegram_id,
      `🎁 <b>Daily Bonus Claimed!</b>\n\n+10 🍯 <b>Hive</b> added to your balance!\n\n📅 Day ${streakDay} streak — keep it up!\n\nCome back tomorrow for your next bonus.`
    );
  }

  return { success: true, hive: 10, message: 'Daily bonus claimed!' };
}

// ─── Reward Codes ─────────────────────────────────────────────────────────────

export async function claimRewardCode(userId: string, code: string): Promise<{ success: boolean; hive: number; message: string }> {
  const guard = await checkNotSuspended(userId);
  if (!guard.ok) return { success: false, hive: 0, message: guard.message };

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
  await creditHive(userId, rc.reward_amount, 'reward_code', `⚡ Reward code: ${code.toUpperCase()}`);
  await createNotification(userId, 'reward_code', '⚡ Reward Code Claimed!', `You earned ${rc.reward_amount} 🍯 Hive!`);

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle();
  if (user) {
    await sendBotMessage(
      user.telegram_id,
      `⚡ <b>Reward Code Claimed!</b>\n\nCode: <code>${code.toUpperCase()}</code>\n+${rc.reward_amount} 🍯 <b>Hive</b> added to your balance!`
    );
  }

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
  const guard = await checkNotSuspended(userId);
  if (!guard.ok) return { success: false, message: guard.message };

  const { data: provider } = await supabase.from('ad_providers').select('*').eq('id', providerId).maybeSingle();
  if (!provider) return { success: false, message: 'Provider not found' };

  const todayCount = await getTodayAdCount(userId, providerId);
  if (todayCount >= provider.daily_limit) return { success: false, message: `Daily limit of ${provider.daily_limit} ads reached` };

  await supabase.from('ad_watches').insert({ user_id: userId, provider_id: providerId, hive_earned: hiveEarned, completed: true });
  await creditHive(userId, hiveEarned, 'ad', `📺 Ad watched - ${provider.name}`);
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
      await creditHive(referral.referrer_id, 50, 'referral', '🍯 Referral watched first 10 ads');
      await createNotification(referral.referrer_id, 'referral', '🐝 Referral Milestone!', `Your referral watched their first 10 ads. +50 🍯 Hive!`);
      const { data: referrerUser } = await supabase.from('users').select('telegram_id').eq('id', referral.referrer_id).maybeSingle();
      if (referrerUser) {
        await sendBotMessage(
          referrerUser.telegram_id,
          `🐝 <b>Referral Milestone!</b>\n\nYour referral completed their first 10 ads!\n\n💰 You earned <b>+50 🍯 Hive</b>!\n\nOne more milestone to go for the full 150 Hive bonus!`
        );
      }
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
      await creditHive(referral.referrer_id, 75, 'referral', '🍯 Referral completed day 2 ads');
      await createNotification(referral.referrer_id, 'referral_completed', '🏆 Referral Completed!', `Your referral completed all milestones. +75 🍯 Hive!`);
      const { data: referrerUser } = await supabase.from('users').select('telegram_id').eq('id', referral.referrer_id).maybeSingle();
      if (referrerUser) {
        await sendBotMessage(
          referrerUser.telegram_id,
          `🏆 <b>Referral Fully Completed!</b>\n\nYour referral completed all milestones!\n\n💰 You earned <b>+75 🍯 Hive</b>!\n\nTotal earned from this referral: <b>150 🍯 Hive</b> 🎉`
        );
      }
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
  const guard = await checkNotSuspended(userId);
  if (!guard.ok) return { success: false, message: guard.message };

  const { data: existing } = await supabase.from('task_completions').select('id').eq('user_id', userId).eq('task_id', taskId).maybeSingle();
  if (existing) return { success: false, message: 'Task already started or completed' };

  await supabase.from('task_completions').insert({ user_id: userId, task_id: taskId, status: 'pending' });
  return { success: true, message: 'Task started - verify to earn reward' };
}

export async function verifyTask(userId: string, taskId: string): Promise<{ success: boolean; hive: number; message: string }> {
  const guard = await checkNotSuspended(userId);
  if (!guard.ok) return { success: false, hive: 0, message: guard.message };

  const { data: tc } = await supabase.from('task_completions').select('*').eq('user_id', userId).eq('task_id', taskId).maybeSingle();
  if (!tc) return { success: false, hive: 0, message: 'Please start the task first' };
  if (tc.status === 'verified') return { success: false, hive: 0, message: 'Task already completed' };

  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { success: false, hive: 0, message: 'Task not found' };

  await supabase.from('task_completions').update({ status: 'verified', hive_earned: task.reward_amount, verified_at: new Date().toISOString() }).eq('user_id', userId).eq('task_id', taskId);
  await creditHive(userId, task.reward_amount, 'task', `✅ Task: ${task.title}`);
  await createNotification(userId, 'task_completed', '✅ Task Completed!', `You earned ${task.reward_amount} 🍯 Hive for completing "${task.title}"`);

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle();
  if (user) {
    await sendBotMessage(
      user.telegram_id,
      `✅ <b>Task Completed!</b>\n\nTask: ${task.title}\n+${task.reward_amount} 🍯 <b>Hive</b> added to your balance!`
    );
  }

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
  const guard = await checkNotSuspended(userId);
  if (!guard.ok) return { success: false, message: guard.message };

  const wallet = await getWallet(userId);
  if (!wallet) return { success: false, message: 'Please set a wallet address first' };

  const { data: user } = await supabase.from('users').select('hive_balance, telegram_id, first_name').eq('id', userId).maybeSingle();
  if (!user || user.hive_balance < hiveAmount) return { success: false, message: 'Insufficient balance' };

  const usdtAmount = hiveAmount * HIVE_TO_USDT;
  const feeFixed = 0.01;
  const feePercent = usdtAmount * 0.05;
  const totalFee = feeFixed + feePercent;
  const netAmount = usdtAmount - totalFee;

  if (usdtAmount < 0.08) return { success: false, message: 'Minimum withdrawal is 0.08 USDT' };
  if (netAmount <= 0) return { success: false, message: 'Amount too small after fees' };

  const deducted = await debitHive(userId, hiveAmount, 'withdraw', `💸 Withdrawal request`);
  if (!deducted) return { success: false, message: 'Failed to deduct balance' };

  const { data: wd } = await supabase.from('withdrawals').insert({
    user_id: userId,
    wallet_address: wallet.address,
    hive_amount: hiveAmount,
    usdt_amount: usdtAmount,
    fee_amount: totalFee,
    net_amount: netAmount,
    status: 'pending',
  }).select().maybeSingle();

  await createNotification(userId, 'withdraw_pending', '💸 Withdrawal Requested', `Your withdrawal of ${netAmount.toFixed(6)} USDT is pending admin approval.`);

  // Notify admin via bot
  await notifyAdmin(
    `💸 <b>New Withdrawal Request</b>\n\nUser: ${user.first_name}\nAmount: <b>${netAmount.toFixed(6)} USDT</b>\nHive: ${hiveAmount}\nWallet: <code>${wallet.address}</code>\n\nPlease review in Admin Panel.`
  );

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
  await createNotification(userId, 'suspended', '🚫 Account Suspended', `Your account has been suspended. Reason: ${reason}`);

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle();
  if (user) {
    await sendBotMessage(
      user.telegram_id,
      `🚫 <b>Account Suspended</b>\n\nYour Hive Earn account has been suspended.\n\n<b>Reason:</b> ${reason}\n\nContact the admin if you believe this is a mistake.`,
      false
    );
  }
}

export async function unsuspendUser(adminId: string, userId: string): Promise<void> {
  await supabase.from('users').update({ is_suspended: false, suspension_reason: null }).eq('id', userId);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'unsuspend_user', target_type: 'user', target_id: userId });

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', userId).maybeSingle();
  if (user) {
    await sendBotMessage(
      user.telegram_id,
      `✅ <b>Account Unsuspended</b>\n\nYour Hive Earn account has been restored. You can now earn Hive again!`
    );
  }
}

export async function approveWithdrawal(adminId: string, withdrawalId: string, txid: string): Promise<void> {
  const { data: wd } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).maybeSingle();
  if (!wd) return;

  await supabase.from('withdrawals').update({ status: 'approved', txid, reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq('id', withdrawalId);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'approve_withdrawal', target_type: 'withdrawal', target_id: withdrawalId, new_data: { txid } });
  await createNotification(wd.user_id, 'withdraw_approved', '✅ Withdrawal Approved!', `Your withdrawal has been approved. TXID: ${txid}`, { txid, amount: wd.net_amount });

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', wd.user_id).maybeSingle();
  if (user) {
    await sendBotMessage(
      user.telegram_id,
      `✅ <b>Withdrawal Approved!</b>\n\nAmount: <b>${wd.net_amount.toFixed(6)} USDT</b>\nWallet: <code>${wd.wallet_address}</code>\n\n🔗 TXID: <code>${txid}</code>\n\n<a href="https://bscscan.com/tx/${txid}">View on BSCScan</a>\n\nThank you for using Hive Earn! 🐝`
    );
  }

  // Notify payment channel
  await sendBotMessage(
    ADMIN_CHAT_ID,
    `💳 <b>Payment Sent</b>\n\nAmount: <b>${wd.net_amount.toFixed(6)} USDT</b>\nTXID: <code>${txid}</code>\n\n<a href="https://bscscan.com/tx/${txid}">View on BSCScan</a>`
  );
}

export async function rejectWithdrawal(adminId: string, withdrawalId: string, reason: string): Promise<void> {
  const { data: wd } = await supabase.from('withdrawals').select('*').eq('id', withdrawalId).maybeSingle();
  if (!wd) return;

  await supabase.from('withdrawals').update({ status: 'rejected', admin_note: reason, reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq('id', withdrawalId);
  await creditHive(wd.user_id, wd.hive_amount, 'adjustment', `💸 Withdrawal rejected - refunded`);
  await supabase.from('admin_logs').insert({ admin_id: adminId, action: 'reject_withdrawal', target_type: 'withdrawal', target_id: withdrawalId, new_data: { reason } });
  await createNotification(wd.user_id, 'withdraw_rejected', '❌ Withdrawal Rejected', `Your withdrawal was rejected. Reason: ${reason}. Funds returned to your balance.`);

  const { data: user } = await supabase.from('users').select('telegram_id').eq('id', wd.user_id).maybeSingle();
  if (user) {
    await sendBotMessage(
      user.telegram_id,
      `❌ <b>Withdrawal Rejected</b>\n\nAmount: ${wd.hive_amount} 🍯 Hive has been returned to your balance.\n\n<b>Reason:</b> ${reason}\n\nPlease check your wallet address and try again.`
    );
  }
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
