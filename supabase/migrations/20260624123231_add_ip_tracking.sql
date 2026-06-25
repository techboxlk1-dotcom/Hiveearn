/*
# Add IP tracking & device fingerprint to users

1. New columns on `users`
   - `ip_address` (text) — last seen IP
   - `device_fingerprint` (text) — browser fingerprint hash
   - `ip_flagged` (boolean) — true when same IP as another account

2. New table `ip_blocks`
   - Stores IPs that are blocked from referral rewards
   - Admin can add/remove entries

3. Purpose
   - Detect multiple accounts per IP (auto-suspend)
   - Block referral fraud from same-IP households
*/

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS ip_flagged boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_ip_address ON users(ip_address);

CREATE TABLE IF NOT EXISTS ip_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  reason text,
  blocked_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ip_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ip_blocks" ON ip_blocks;
CREATE POLICY "anon_select_ip_blocks" ON ip_blocks FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ip_blocks" ON ip_blocks;
CREATE POLICY "anon_insert_ip_blocks" ON ip_blocks FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ip_blocks" ON ip_blocks;
CREATE POLICY "anon_update_ip_blocks" ON ip_blocks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ip_blocks" ON ip_blocks;
CREATE POLICY "anon_delete_ip_blocks" ON ip_blocks FOR DELETE TO anon, authenticated USING (true);
