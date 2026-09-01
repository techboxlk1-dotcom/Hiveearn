/*
# V2 Economy & Mining Overhaul

## Purpose
Migrates the app from V1 to V2 economy. All coin values multiplied by 10.
New conversion: 1000 coins = $0.01 USDT (1 coin = $0.00001).
Old conversion was: 100 Hive = $0.01 USDT (1 Hive = $0.0001).
Dollar values stay the same — only coin numbers change.

## Changes

### 1. Balance Migration
- All users' `hive_balance` multiplied by 10 (preserves dollar value)
- All users' `total_earned` multiplied by 10
- All users' `total_withdrawn` multiplied by 10
- All users' `unclaimed_referral_hive` multiplied by 10

### 2. Mining Changes
- New column `mining_daily_claims` (integer, default 0) — tracks claims per day
- New column `mining_last_claim_date` (date, nullable) — resets daily claim counter
- Mining rate changed to 100 coins per session (was 20 Hive/hour)
- Maximum 10 claims per day
- Mining stops after 1 hour, must claim and restart

### 3. Withdrawal Settings
- Minimum withdrawal changed to $0.01 (1000 coins) for all tiers
- Maximum withdrawal stays at $0.50

### 4. V2 Launch Marker
- New setting `v2_launch_at` — timestamp marking V2 start
- Transactions before this date are hidden from V2 UI (not deleted)

### 5. Giveaway/Spin/MiniGame Disabled
- Setting `v2_features_disabled` = 'giveaway,spin,minigame'

## Security
- No RLS policy changes (existing policies remain)
- No data deleted — only updated
*/

-- Multiply all balances by 10 (preserves dollar value since rate also /10)
UPDATE users SET hive_balance = hive_balance * 10 WHERE hive_balance > 0;
UPDATE users SET total_earned = COALESCE(total_earned, 0) * 10 WHERE COALESCE(total_earned, 0) > 0;
UPDATE users SET total_withdrawn = COALESCE(total_withdrawn, 0) * 10 WHERE COALESCE(total_withdrawn, 0) > 0;
UPDATE users SET unclaimed_referral_hive = COALESCE(unclaimed_referral_hive, 0) * 10 WHERE COALESCE(unclaimed_referral_hive, 0) > 0;

-- Add mining daily tracking columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_daily_claims integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_last_claim_date date;

-- Update mining rate to 100 coins per session
INSERT INTO app_settings (key, value) VALUES ('mining_rate_per_hour', '100')
ON CONFLICT (key) DO UPDATE SET value = '100';

-- Update withdrawal minimums to $0.01 (1000 coins)
INSERT INTO app_settings (key, value) VALUES ('min_withdrawal_first', '0.01')
ON CONFLICT (key) DO UPDATE SET value = '0.01';
INSERT INTO app_settings (key, value) VALUES ('min_withdrawal_second', '0.01')
ON CONFLICT (key) DO UPDATE SET value = '0.01';

-- Keep max withdrawal at $0.50
INSERT INTO app_settings (key, value) VALUES ('max_withdrawal', '0.50')
ON CONFLICT (key) DO UPDATE SET value = '0.50';

-- V2 launch timestamp — used to filter transaction history
INSERT INTO app_settings (key, value) VALUES ('v2_launch_at', NOW()::text)
ON CONFLICT (key) DO UPDATE SET value = NOW()::text;

-- Mark disabled V1 features
INSERT INTO app_settings (key, value) VALUES ('v2_features_disabled', 'giveaway,spin,minigame')
ON CONFLICT (key) DO UPDATE SET value = 'giveaway,spin,minigame';

-- Update daily bonus reward to 100 coins (was 10 Hive)
INSERT INTO app_settings (key, value) VALUES ('daily_bonus_amount', '100')
ON CONFLICT (key) DO UPDATE SET value = '100';

-- Update referral reward to 1500 coins (was 150 Hive)
INSERT INTO app_settings (key, value) VALUES ('referral_reward_amount', '1500')
ON CONFLICT (key) DO UPDATE SET value = '1500';
