/*
# Add reward_type to ad_providers

1. Modified Tables
- `ad_providers`: Added `reward_type` text column (default 'hive')
  - 'hive' = provider shown in the Earn tab (Hive rewards)
  - 'baby_hive' = provider shown in the Giveaway > Earn Baby Hive tab
  - Allows admin to manage Baby Hive ad providers separately from Hive ad providers
2. Security
- No RLS changes needed (existing policies cover the new column)
*/

ALTER TABLE ad_providers ADD COLUMN IF NOT EXISTS reward_type text DEFAULT 'hive';

-- Backfill existing rows
UPDATE ad_providers SET reward_type = 'hive' WHERE reward_type IS NULL;
