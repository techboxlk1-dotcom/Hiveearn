/*
# Add mining_notified flag

1. Modified Tables
- `users`: Added `mining_notified` boolean column (default false)
  - Used to send a one-time notification when mining reaches 1 hour
  - Reset to false when mining starts again
2. Security
- No RLS changes needed (existing policies cover the new column)
*/

ALTER TABLE users ADD COLUMN IF NOT EXISTS mining_notified boolean DEFAULT false;
