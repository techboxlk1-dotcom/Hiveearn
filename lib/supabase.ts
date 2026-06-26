import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> };
      wallets: { Row: Wallet; Insert: Partial<Wallet>; Update: Partial<Wallet> };
      transactions: { Row: Transaction; Insert: Partial<Transaction>; Update: Partial<Transaction> };
      withdrawals: { Row: Withdrawal; Insert: Partial<Withdrawal>; Update: Partial<Withdrawal> };
      reward_codes: { Row: RewardCode; Insert: Partial<RewardCode>; Update: Partial<RewardCode> };
      reward_code_claims: { Row: RewardCodeClaim; Insert: Partial<RewardCodeClaim>; Update: Partial<RewardCodeClaim> };
      daily_bonus_claims: { Row: DailyBonusClaim; Insert: Partial<DailyBonusClaim>; Update: Partial<DailyBonusClaim> };
      ad_providers: { Row: AdProvider; Insert: Partial<AdProvider>; Update: Partial<AdProvider> };
      ad_watches: { Row: AdWatch; Insert: Partial<AdWatch>; Update: Partial<AdWatch> };
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> };
      task_completions: { Row: TaskCompletion; Insert: Partial<TaskCompletion>; Update: Partial<TaskCompletion> };
      referrals: { Row: Referral; Insert: Partial<Referral>; Update: Partial<Referral> };
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> };
      announcements: { Row: Announcement; Insert: Partial<Announcement>; Update: Partial<Announcement> };
      fraud_logs: { Row: FraudLog; Insert: Partial<FraudLog>; Update: Partial<FraudLog> };
      admin_logs: { Row: AdminLog; Insert: Partial<AdminLog>; Update: Partial<AdminLog> };
      app_settings: { Row: AppSetting; Insert: Partial<AppSetting>; Update: Partial<AppSetting> };
      visit_websites: { Row: VisitWebsite; Insert: Partial<VisitWebsite>; Update: Partial<VisitWebsite> };
      website_visits: { Row: WebsiteVisit; Insert: Partial<WebsiteVisit>; Update: Partial<WebsiteVisit> };
    };
  };
};

export interface User {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  hive_balance: number;
  is_admin: boolean;
  is_manager: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  referral_code: string | null;
  referred_by: string | null;
  language: string;
  ip_address: string | null;
  device_fingerprint: string | null;
  ip_flagged: boolean;
  unclaimed_referral_hive: number;
  withdrawal_count: number;
  listed: boolean;
  total_earned: number;
  total_withdrawn: number;
  total_ads_watched: number;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  network: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'reward' | 'ad' | 'task' | 'referral' | 'daily_bonus' | 'reward_code' | 'withdraw' | 'deposit' | 'adjustment';
  amount: number;
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  wallet_address: string;
  hive_amount: number;
  usdt_amount: number;
  fee_amount: number;
  net_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processing';
  txid: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  withdraw_id: string | null;
  ad_block: number;
  created_at: string;
  updated_at: string;
}

export interface RewardCode {
  id: string;
  code: string;
  reward_amount: number;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_by: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RewardCodeClaim {
  id: string;
  user_id: string;
  reward_code_id: string;
  hive_earned: number;
  created_at: string;
}

export interface DailyBonusClaim {
  id: string;
  user_id: string;
  hive_earned: number;
  streak_day: number;
  claimed_at: string;
}

export interface AdProvider {
  id: string;
  name: string;
  slug: string;
  reward_per_ad: number;
  daily_limit: number;
  is_active: boolean;
  sort_order: number;
  block_id: string | null;
  network_type: string | null;
  min_watch_seconds: number | null;
  sdk_zone: string | null;
  created_at: string;
}

export interface AdWatch {
  id: string;
  user_id: string;
  provider_id: string;
  hive_earned: number;
  completed: boolean;
  watched_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  category: 'main' | 'partner' | 'community';
  telegram_username: string | null;
  telegram_link: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  requires_verification: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskCompletion {
  id: string;
  user_id: string;
  task_id: string;
  status: 'pending' | 'verified' | 'rejected';
  hive_earned: number | null;
  verified_at: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: 'pending' | 'completed' | 'fake' | 'blocked';
  join_reward_paid: boolean;
  first_ads_reward_paid: boolean;
  second_day_reward_paid: boolean;
  total_hive_earned: number;
  deadline_at: string | null;
  completed_at: string | null;
  fake_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'promotion';
  is_active: boolean;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FraudLog {
  id: string;
  user_id: string | null;
  type: string;
  description: string | null;
  ip_address: string | null;
  device_info: Record<string, unknown> | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface VisitWebsite {
  id: string;
  name: string;
  url: string;
  reward_hive: number;
  min_watch_seconds: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface WebsiteVisit {
  id: string;
  user_id: string;
  website_id: string;
  hive_earned: number;
  visited_at: string;
}
