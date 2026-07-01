/*
# Add task types, auto-withdraw support, withdraw unlock tracking, and daily reminder settings

## Overview
This migration adds support for:
1. Bot and link task types (trust verify on touch after start)
2. Auto-withdraw approval method with auto-generated txid
3. Withdraw unlock tracking (stays unlocked until daily reset at 00:00 UTC)
4. Pending withdrawal check (block new withdrawal if one is pending)
5. Daily reminder message settings
6. Broadcast channel posting settings
7. Payment method tracking on withdrawals

## New Columns

### tasks table
- `task_type` (text) — 'channel' (default, existing), 'bot', 'link'. Controls how the task is verified.
  - 'channel': Telegram channel join verification (existing behavior)
  - 'bot': Bot interaction task — verify on touch after start
  - 'link': External link visit task — verify on touch after start

### withdrawals table
- `payment_method` (text) — 'manual' or 'auto'. Tracks how the withdrawal was approved.
- `auto_txid` (text) — Auto-generated transaction ID for auto-approvals.

### users table
- `withdraw_unlocked_at` (timestamptz) — When withdraw ad-gate was unlocked. If set today (UTC), withdraw is unlocked.
- `last_reminder_at` (timestamptz) — Last time a daily reminder was sent to this user.

## New app_settings keys
- `daily_reminder_enabled` — 'true'/'false' toggle for daily reminders
- `daily_reminder_interval_hours` — Hours between reminders (default '4')
- `welcome_banner_url` — URL for welcome banner image
- `auto_withdraw_enabled` — 'true'/'false' toggle for auto-withdraw method
- `auto_withdraw_wallet` — Trust wallet address for auto-payments (admin config)

## Security
- RLS already enabled on all tables. No new tables created.
- Existing policies remain unchanged (anon/authenticated full CRUD).
*/

-- Add task_type to tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'channel';

-- Add payment_method and auto_txid to withdrawals
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_txid text;

-- Add withdraw_unlocked_at and last_reminder_at to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS withdraw_unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

-- Create index for withdraw unlock check
CREATE INDEX IF NOT EXISTS idx_users_withdraw_unlocked ON users(withdraw_unlocked_at);

-- Seed new app settings
INSERT INTO app_settings (key, value, description) VALUES
  ('daily_reminder_enabled', 'true', 'Send daily reminder messages to users via bot'),
  ('daily_reminder_interval_hours', '4', 'Hours between daily reminder messages'),
  ('auto_withdraw_enabled', 'false', 'Enable auto-withdraw approval method'),
  ('auto_withdraw_wallet', '', 'Trust wallet address for auto-payments'),
  ('broadcast_to_channel', 'true', 'Also post broadcasts to community channel')
ON CONFLICT (key) DO NOTHING;
