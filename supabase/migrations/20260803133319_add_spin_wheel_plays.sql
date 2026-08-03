/*
# Add spin wheel plays table

1. New Tables
- `spin_wheel_plays`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null — references users table)
  - `hive_won` (integer, amount of Hive won from the spin, 2-20)
  - `played_at` (timestamptz, default now)
  - Tracks each spin wheel play; used to enforce 12-hour cooldown
2. Security
- Enable RLS on `spin_wheel_plays`
- Owner-scoped CRUD: authenticated users can only access their own spin plays
3. Notes
- The 12-hour cooldown is enforced in the API layer by checking the most recent play
- Hive reward range is 2-20, weighted toward lower values
*/

CREATE TABLE IF NOT EXISTS spin_wheel_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hive_won integer NOT NULL,
  played_at timestamptz DEFAULT now()
);

ALTER TABLE spin_wheel_plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_spins" ON spin_wheel_plays;
CREATE POLICY "select_own_spins" ON spin_wheel_plays FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_spins" ON spin_wheel_plays;
CREATE POLICY "insert_own_spins" ON spin_wheel_plays FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_spins" ON spin_wheel_plays;
CREATE POLICY "update_own_spins" ON spin_wheel_plays FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_spins" ON spin_wheel_plays;
CREATE POLICY "delete_own_spins" ON spin_wheel_plays FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_spin_plays_user_time ON spin_wheel_plays(user_id, played_at DESC);
