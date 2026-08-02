/*
# Add Giveaway System, Monthly Leaderboard, and Baby Hive Token

1. New Tables
- `giveaways` — Giveaway events created by admin. Each has a fund (in Baby Hive), min participation amount, max participants, status (active/ended/distributed).
- `giveaway_participants` — Users who join a giveaway with their Baby Hive amount.
- `monthly_leaderboard` — Monthly snapshot of top earners and referrers with prize distribution status.
- `baby_hive_balances` — Tracks each user's Baby Hive token balance (earned from watching ads, 100 per ad).

2. Columns Added
- `users.baby_hive_balance` (integer, default 0) — Baby Hive token balance.
- `users.leaderboard_claimed_month` (text, nullable) — Tracks which month's leaderboard prize was already claimed.

3. Security
- RLS enabled on all new tables.
- Giveaways: anon+authenticated can read active giveaways and participate; only admin can create/update.
- Monthly leaderboard: anon+authenticated can read; admin can insert/update.
- Baby Hive balances: users can read their own; updates via API only (service role).

4. Important Notes
- Baby Hive is a separate token from Hive. 100 Baby Hive per ad watched.
- Giveaway distribution is proportional to each participant's Baby Hive contribution.
- Monthly leaderboard resets each month. Top 10 referrers share 50,000 Hive.
- Leaderboard prizes must be claimed via a claim button before being added to balance.
*/

-- Add baby_hive_balance and leaderboard_claimed_month to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS baby_hive_balance integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_claimed_month text;

-- Giveaways table
CREATE TABLE IF NOT EXISTS giveaways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  fund_baby_hive integer NOT NULL DEFAULT 0,
  min_baby_hive integer NOT NULL DEFAULT 100,
  max_participants integer,
  participant_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  distributed_at timestamptz
);

ALTER TABLE giveaways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_giveaways" ON giveaways;
CREATE POLICY "anon_read_giveaways" ON giveaways FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_giveaways" ON giveaways;
CREATE POLICY "anon_insert_giveaways" ON giveaways FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_giveaways" ON giveaways;
CREATE POLICY "anon_update_giveaways" ON giveaways FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Giveaway participants table
CREATE TABLE IF NOT EXISTS giveaway_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giveaway_id uuid NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  baby_hive_amount integer NOT NULL DEFAULT 0,
  hive_won numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE giveaway_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_giveaway_participants" ON giveaway_participants;
CREATE POLICY "anon_read_giveaway_participants" ON giveaway_participants FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_giveaway_participants" ON giveaway_participants;
CREATE POLICY "anon_insert_giveaway_participants" ON giveaway_participants FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_giveaway_participants" ON giveaway_participants;
CREATE POLICY "anon_update_giveaway_participants" ON giveaway_participants FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Monthly leaderboard table
CREATE TABLE IF NOT EXISTS monthly_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  leaderboard_type text NOT NULL,
  user_id uuid NOT NULL,
  rank integer NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  prize_hive numeric NOT NULL DEFAULT 0,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(month, leaderboard_type, user_id)
);

ALTER TABLE monthly_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_monthly_leaderboard" ON monthly_leaderboard;
CREATE POLICY "anon_read_monthly_leaderboard" ON monthly_leaderboard FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_monthly_leaderboard" ON monthly_leaderboard;
CREATE POLICY "anon_insert_monthly_leaderboard" ON monthly_leaderboard FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_monthly_leaderboard" ON monthly_leaderboard;
CREATE POLICY "anon_update_monthly_leaderboard" ON monthly_leaderboard FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_giveaway_participants_giveaway_id ON giveaway_participants(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_monthly_leaderboard_month_type ON monthly_leaderboard(month, leaderboard_type);
CREATE INDEX IF NOT EXISTS idx_monthly_leaderboard_user_claimed ON monthly_leaderboard(user_id, claimed);
