/*
# Hive Earn - Complete Database Schema

## Overview
Full schema for the Hive Earn Telegram Mini App including users, wallets, transactions,
withdrawals, reward codes, daily bonuses, ads, tasks, referrals, notifications,
leaderboard, announcements, fraud logs, and admin logs.

## Tables Created
1. `users` - Telegram users registered in the app
2. `wallets` - BEP20 USDT wallet addresses per user
3. `transactions` - All transaction history (rewards, ads, tasks, referrals, withdrawals)
4. `withdrawals` - Withdrawal requests with admin approval workflow
5. `reward_codes` - Admin-created reward codes
6. `reward_code_claims` - Tracks which users claimed which codes
7. `daily_bonus_claims` - Daily bonus claim history
8. `ad_providers` - Ad provider configuration
9. `ad_watches` - Individual ad watch records
10. `tasks` - Tasks (main/partner/community) with verification
11. `task_completions` - Task completion records per user
12. `referrals` - Referral relationships and reward tracking
13. `notifications` - User and admin notifications
14. `announcements` - System announcements
15. `fraud_logs` - Fraud detection records
16. `admin_logs` - Admin action audit trail
17. `app_settings` - Global application settings

## Security
- RLS enabled on all tables
- Public read/write for app operations (Telegram-authenticated via custom user_id)
- Admin operations use service role
*/

-- Users table: stores Telegram user data
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  username text,
  first_name text NOT NULL DEFAULT '',
  last_name text,
  photo_url text,
  hive_balance numeric(20, 4) NOT NULL DEFAULT 0,
  is_admin boolean NOT NULL DEFAULT false,
  is_suspended boolean NOT NULL DEFAULT false,
  suspension_reason text,
  referral_code text UNIQUE,
  referred_by uuid REFERENCES users(id),
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_users" ON users;
CREATE POLICY "anon_select_users" ON users FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_users" ON users;
CREATE POLICY "anon_insert_users" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_users" ON users;
CREATE POLICY "anon_update_users" ON users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_users" ON users;
CREATE POLICY "anon_delete_users" ON users FOR DELETE TO anon, authenticated USING (true);

-- Wallets table: BEP20 USDT addresses
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address text NOT NULL,
  network text NOT NULL DEFAULT 'BEP20',
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_wallets" ON wallets;
CREATE POLICY "anon_select_wallets" ON wallets FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_wallets" ON wallets;
CREATE POLICY "anon_insert_wallets" ON wallets FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_wallets" ON wallets;
CREATE POLICY "anon_update_wallets" ON wallets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_wallets" ON wallets;
CREATE POLICY "anon_delete_wallets" ON wallets FOR DELETE TO anon, authenticated USING (true);

-- Transactions table: full history
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reward', 'ad', 'task', 'referral', 'daily_bonus', 'reward_code', 'withdraw', 'deposit', 'adjustment')),
  amount numeric(20, 4) NOT NULL,
  description text,
  reference_id uuid,
  reference_type text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE TO anon, authenticated USING (true);

-- Withdrawals table
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  hive_amount numeric(20, 4) NOT NULL,
  usdt_amount numeric(20, 8) NOT NULL,
  fee_amount numeric(20, 8) NOT NULL DEFAULT 0,
  net_amount numeric(20, 8) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing')),
  txid text,
  admin_note text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_withdrawals" ON withdrawals;
CREATE POLICY "anon_select_withdrawals" ON withdrawals FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_withdrawals" ON withdrawals;
CREATE POLICY "anon_insert_withdrawals" ON withdrawals FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_withdrawals" ON withdrawals;
CREATE POLICY "anon_update_withdrawals" ON withdrawals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_withdrawals" ON withdrawals;
CREATE POLICY "anon_delete_withdrawals" ON withdrawals FOR DELETE TO anon, authenticated USING (true);

-- Reward codes table
CREATE TABLE IF NOT EXISTS reward_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  reward_amount numeric(20, 4) NOT NULL,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reward_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reward_codes" ON reward_codes;
CREATE POLICY "anon_select_reward_codes" ON reward_codes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reward_codes" ON reward_codes;
CREATE POLICY "anon_insert_reward_codes" ON reward_codes FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reward_codes" ON reward_codes;
CREATE POLICY "anon_update_reward_codes" ON reward_codes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reward_codes" ON reward_codes;
CREATE POLICY "anon_delete_reward_codes" ON reward_codes FOR DELETE TO anon, authenticated USING (true);

-- Reward code claims
CREATE TABLE IF NOT EXISTS reward_code_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_code_id uuid NOT NULL REFERENCES reward_codes(id) ON DELETE CASCADE,
  hive_earned numeric(20, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_code_id)
);

ALTER TABLE reward_code_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reward_code_claims" ON reward_code_claims;
CREATE POLICY "anon_select_reward_code_claims" ON reward_code_claims FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reward_code_claims" ON reward_code_claims;
CREATE POLICY "anon_insert_reward_code_claims" ON reward_code_claims FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reward_code_claims" ON reward_code_claims;
CREATE POLICY "anon_update_reward_code_claims" ON reward_code_claims FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reward_code_claims" ON reward_code_claims;
CREATE POLICY "anon_delete_reward_code_claims" ON reward_code_claims FOR DELETE TO anon, authenticated USING (true);

-- Daily bonus claims
CREATE TABLE IF NOT EXISTS daily_bonus_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hive_earned numeric(20, 4) NOT NULL DEFAULT 10,
  streak_day integer NOT NULL DEFAULT 1,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_bonus_user_id ON daily_bonus_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_bonus_claimed_at ON daily_bonus_claims(claimed_at DESC);

ALTER TABLE daily_bonus_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_bonus_claims" ON daily_bonus_claims;
CREATE POLICY "anon_select_daily_bonus_claims" ON daily_bonus_claims FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_daily_bonus_claims" ON daily_bonus_claims;
CREATE POLICY "anon_insert_daily_bonus_claims" ON daily_bonus_claims FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_daily_bonus_claims" ON daily_bonus_claims;
CREATE POLICY "anon_update_daily_bonus_claims" ON daily_bonus_claims FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_daily_bonus_claims" ON daily_bonus_claims;
CREATE POLICY "anon_delete_daily_bonus_claims" ON daily_bonus_claims FOR DELETE TO anon, authenticated USING (true);

-- Ad providers
CREATE TABLE IF NOT EXISTS ad_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  reward_per_ad numeric(20, 4) NOT NULL,
  daily_limit integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ad_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ad_providers" ON ad_providers;
CREATE POLICY "anon_select_ad_providers" ON ad_providers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ad_providers" ON ad_providers;
CREATE POLICY "anon_insert_ad_providers" ON ad_providers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ad_providers" ON ad_providers;
CREATE POLICY "anon_update_ad_providers" ON ad_providers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ad_providers" ON ad_providers;
CREATE POLICY "anon_delete_ad_providers" ON ad_providers FOR DELETE TO anon, authenticated USING (true);

-- Ad watches
CREATE TABLE IF NOT EXISTS ad_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES ad_providers(id) ON DELETE CASCADE,
  hive_earned numeric(20, 4) NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  watched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_watches_user_id ON ad_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_watches_provider_id ON ad_watches(provider_id);
CREATE INDEX IF NOT EXISTS idx_ad_watches_watched_at ON ad_watches(watched_at DESC);

ALTER TABLE ad_watches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ad_watches" ON ad_watches;
CREATE POLICY "anon_select_ad_watches" ON ad_watches FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ad_watches" ON ad_watches;
CREATE POLICY "anon_insert_ad_watches" ON ad_watches FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ad_watches" ON ad_watches;
CREATE POLICY "anon_update_ad_watches" ON ad_watches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ad_watches" ON ad_watches;
CREATE POLICY "anon_delete_ad_watches" ON ad_watches FOR DELETE TO anon, authenticated USING (true);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  reward_amount numeric(20, 4) NOT NULL,
  category text NOT NULL DEFAULT 'main' CHECK (category IN ('main', 'partner', 'community')),
  telegram_username text,
  telegram_link text,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  requires_verification boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tasks" ON tasks;
CREATE POLICY "anon_select_tasks" ON tasks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tasks" ON tasks;
CREATE POLICY "anon_insert_tasks" ON tasks FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tasks" ON tasks;
CREATE POLICY "anon_update_tasks" ON tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tasks" ON tasks;
CREATE POLICY "anon_delete_tasks" ON tasks FOR DELETE TO anon, authenticated USING (true);

-- Task completions
CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  hive_earned numeric(20, 4),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON task_completions(user_id);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_task_completions" ON task_completions;
CREATE POLICY "anon_select_task_completions" ON task_completions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_task_completions" ON task_completions;
CREATE POLICY "anon_insert_task_completions" ON task_completions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_task_completions" ON task_completions;
CREATE POLICY "anon_update_task_completions" ON task_completions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_task_completions" ON task_completions;
CREATE POLICY "anon_delete_task_completions" ON task_completions FOR DELETE TO anon, authenticated USING (true);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'fake', 'blocked')),
  join_reward_paid boolean NOT NULL DEFAULT false,
  first_ads_reward_paid boolean NOT NULL DEFAULT false,
  second_day_reward_paid boolean NOT NULL DEFAULT false,
  total_hive_earned numeric(20, 4) NOT NULL DEFAULT 0,
  deadline_at timestamptz,
  completed_at timestamptz,
  fake_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_referrals" ON referrals;
CREATE POLICY "anon_select_referrals" ON referrals FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_referrals" ON referrals;
CREATE POLICY "anon_insert_referrals" ON referrals FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_referrals" ON referrals;
CREATE POLICY "anon_update_referrals" ON referrals FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_referrals" ON referrals;
CREATE POLICY "anon_delete_referrals" ON referrals FOR DELETE TO anon, authenticated USING (true);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE TO anon, authenticated USING (true);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'promotion')),
  is_active boolean NOT NULL DEFAULT true,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_announcements" ON announcements;
CREATE POLICY "anon_select_announcements" ON announcements FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_announcements" ON announcements;
CREATE POLICY "anon_insert_announcements" ON announcements FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_announcements" ON announcements;
CREATE POLICY "anon_update_announcements" ON announcements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_announcements" ON announcements;
CREATE POLICY "anon_delete_announcements" ON announcements FOR DELETE TO anon, authenticated USING (true);

-- Fraud logs
CREATE TABLE IF NOT EXISTS fraud_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('multiple_accounts', 'same_ip', 'vpn', 'emulator', 'bot', 'spam', 'referral_abuse', 'other')),
  description text,
  ip_address text,
  device_info jsonb,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_logs_user_id ON fraud_logs(user_id);

ALTER TABLE fraud_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fraud_logs" ON fraud_logs;
CREATE POLICY "anon_select_fraud_logs" ON fraud_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fraud_logs" ON fraud_logs;
CREATE POLICY "anon_insert_fraud_logs" ON fraud_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fraud_logs" ON fraud_logs;
CREATE POLICY "anon_update_fraud_logs" ON fraud_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fraud_logs" ON fraud_logs;
CREATE POLICY "anon_delete_fraud_logs" ON fraud_logs FOR DELETE TO anon, authenticated USING (true);

-- Admin logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_admin_logs" ON admin_logs;
CREATE POLICY "anon_select_admin_logs" ON admin_logs FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_admin_logs" ON admin_logs;
CREATE POLICY "anon_insert_admin_logs" ON admin_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_admin_logs" ON admin_logs;
CREATE POLICY "anon_update_admin_logs" ON admin_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_admin_logs" ON admin_logs;
CREATE POLICY "anon_delete_admin_logs" ON admin_logs FOR DELETE TO anon, authenticated USING (true);

-- App settings
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_settings" ON app_settings;
CREATE POLICY "anon_select_app_settings" ON app_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_settings" ON app_settings;
CREATE POLICY "anon_insert_app_settings" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_settings" ON app_settings;
CREATE POLICY "anon_update_app_settings" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_settings" ON app_settings;
CREATE POLICY "anon_delete_app_settings" ON app_settings FOR DELETE TO anon, authenticated USING (true);

-- Seed ad providers
INSERT INTO ad_providers (name, slug, reward_per_ad, daily_limit, sort_order) VALUES
  ('AdsGram AI', 'adsgram', 10, 10, 1),
  ('Monetag', 'monetag', 5, 10, 2),
  ('Gigapub', 'gigapub', 5, 10, 3)
ON CONFLICT (slug) DO NOTHING;

-- Seed default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('hive_to_usdt_rate', '0.0001', '1 Hive = 0.0001 USDT (100 Hive = 0.01 USDT)'),
  ('min_withdraw_usdt', '0.08', 'Minimum withdrawal amount in USDT'),
  ('withdraw_fee_fixed', '0.01', 'Fixed withdrawal fee in USDT'),
  ('withdraw_fee_percent', '5', 'Percentage withdrawal fee'),
  ('daily_bonus_amount', '10', 'Daily bonus in Hive'),
  ('referral_join_reward', '25', 'Hive reward when referred user joins'),
  ('referral_first_ads_reward', '50', 'Hive reward when referred user watches first 10 ads'),
  ('referral_second_day_reward', '75', 'Hive reward when referred user watches 10 ads on day 2'),
  ('referral_deadline_hours', '48', 'Hours for referral to complete requirements'),
  ('telegram_bot_username', 'Hiveearnbot', 'Telegram bot username'),
  ('mini_app_url', 'https://t.me/Hiveearnbot/play', 'Mini app URL'),
  ('community_channel', '@hiveearn', 'Community channel username'),
  ('payment_channel', '@hiveearnpayment', 'Payment channel username')
ON CONFLICT (key) DO NOTHING;

-- Seed sample tasks
INSERT INTO tasks (title, description, reward_amount, category, telegram_link, sort_order) VALUES
  ('Join Hive Earn Community', 'Join our official Telegram community channel', 50, 'community', 'https://t.me/hiveearn', 1),
  ('Follow Payment Channel', 'Follow our payment proof channel', 30, 'community', 'https://t.me/hiveearnpayment', 2),
  ('Share Hive Earn', 'Share Hive Earn with your friends', 20, 'main', NULL, 3)
ON CONFLICT DO NOTHING;
