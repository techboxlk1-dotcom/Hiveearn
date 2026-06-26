
-- Add new columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unclaimed_referral_hive numeric(20, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawal_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listed_reason text,
  ADD COLUMN IF NOT EXISTS total_earned numeric(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn numeric(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ads_watched integer NOT NULL DEFAULT 0;

-- Add withdraw_id to withdrawals
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS withdraw_id text,
  ADD COLUMN IF NOT EXISTS ad_block text;

-- Create visit_websites table (admin-configurable)
CREATE TABLE IF NOT EXISTS visit_websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  url text NOT NULL,
  reward_hive integer NOT NULL DEFAULT 5,
  min_watch_seconds integer NOT NULL DEFAULT 15,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE visit_websites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_visit_websites" ON visit_websites FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_visit_websites" ON visit_websites FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_visit_websites" ON visit_websites FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_visit_websites" ON visit_websites FOR DELETE TO anon, authenticated USING (true);

-- Create website_visits table (user visit tracking)
CREATE TABLE IF NOT EXISTS website_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES visit_websites(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  hive_earned integer NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_website_visits_user_id ON website_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_website_visits_website_id ON website_visits(website_id);

ALTER TABLE website_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_website_visits" ON website_visits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_website_visits" ON website_visits FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_website_visits" ON website_visits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_website_visits" ON website_visits FOR DELETE TO anon, authenticated USING (true);

-- Add block_id and network_type to ad_providers
ALTER TABLE ad_providers
  ADD COLUMN IF NOT EXISTS block_id text,
  ADD COLUMN IF NOT EXISTS network_type text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS min_watch_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sdk_zone text;

-- Seed visit_websites with the 5 requested sites
INSERT INTO visit_websites (title, url, reward_hive, min_watch_seconds, sort_order) VALUES
  ('Website 1', 'https://omg10.com/4/10176898', 5, 15, 1),
  ('Website 2', 'https://link.gigapub.tech/l/c6f9w5f4h', 5, 15, 2),
  ('Website 3', 'https://omg10.com/4/10339385', 5, 15, 3),
  ('Website 4', 'https://link.gigapub.tech/l/9axf7umt77', 5, 15, 4),
  ('Website 5', 'https://omg10.com/4/10473220', 5, 15, 5)
ON CONFLICT DO NOTHING;

-- Update ad_providers with block_ids and network types
UPDATE ad_providers SET
  block_id = '36138',
  network_type = 'adsgram',
  reward_per_ad = 8,
  daily_limit = 15,
  min_watch_seconds = 15
WHERE slug = 'adsgram';

UPDATE ad_providers SET
  network_type = 'monetag',
  sdk_zone = '11196790',
  reward_per_ad = 5,
  daily_limit = 10,
  min_watch_seconds = 10
WHERE slug = 'monetag';

UPDATE ad_providers SET
  network_type = 'gigapub',
  reward_per_ad = 5,
  daily_limit = 10,
  min_watch_seconds = 10
WHERE slug = 'gigapub';

-- Seed new app settings
INSERT INTO app_settings (key, value) VALUES
  ('adsgram_auto_block', 'int-36139'),
  ('adsgram_reward_block', '36138'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'We are currently updating the app. Please try again in a few minutes.'),
  ('min_withdrawal_first', '0.08'),
  ('min_withdrawal_second', '0.15'),
  ('max_withdrawal', '0.5'),
  ('withdraw_req_daily_ads', '20'),
  ('withdraw_req_refers', '2'),
  ('withdraw_req_main_tasks', 'true'),
  ('total_paid_usdt', '0'),
  ('community_channel', 'hiveearn'),
  ('payment_channel', 'hiveearnpayment')
ON CONFLICT (key) DO NOTHING;
