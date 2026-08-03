/*
# Add winner_count to giveaways table

1. Modified Tables
- `giveaways`: Added `winner_count` integer column (default 10)
  - Controls how many users are selected as winners when a giveaway ends
  - Winners are selected by their Baby Hive contribution amount (top N)
2. Security
- No RLS changes needed (existing policies cover the new column)
*/

ALTER TABLE giveaways ADD COLUMN IF NOT EXISTS winner_count integer NOT NULL DEFAULT 10;
