/*
# Add mining feature and new ad providers (Taddy + TowerAds)

1. Changes to users table:
- Add `mining_started_at` (timestamptz, nullable) — tracks when hourly mining started.
  Mining gives 20 Hive per hour. When user claims, elapsed time is calculated
  and Hive is credited, then mining_started_at resets to now (continues mining).

2. New ad providers inserted into ad_providers:
- Taddy Ads: slug='taddy', 3 Hive/ad, 10 ads/day, network_type='taddy'
- TowerAds: slug='towerads', 4 Hive/ad, 10 ads/day, network_type='towerads'
  Both are inserted only if they don't already exist (idempotent).

3. Task types:
- task_type column is text, 'miniapp' value is now used for Telegram mini app tasks
  with a 5-second countdown before claim. No constraint change needed.

4. Security:
- No new tables, no RLS policy changes needed.
- mining_started_at is on the existing users table which already has RLS.
*/

-- Add mining_started_at to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_started_at timestamptz;

-- Insert Taddy ad provider (idempotent)
INSERT INTO ad_providers (name, slug, reward_per_ad, daily_limit, sort_order, network_type, is_active)
SELECT 'Taddy Ads', 'taddy', 3, 10, 5, 'taddy', true
WHERE NOT EXISTS (SELECT 1 FROM ad_providers WHERE slug = 'taddy');

-- Insert TowerAds ad provider (idempotent)
INSERT INTO ad_providers (name, slug, reward_per_ad, daily_limit, sort_order, network_type, is_active)
SELECT 'TowerAds', 'towerads', 4, 10, 6, 'towerads', true
WHERE NOT EXISTS (SELECT 1 FROM ad_providers WHERE slug = 'towerads');
