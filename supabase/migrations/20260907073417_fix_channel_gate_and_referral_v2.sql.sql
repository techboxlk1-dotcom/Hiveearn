/*
# Fix Channel Gate & Referral V2 Settings

## Changes

### 1. Channel Verification Persistence
- Adds `channels_verified` boolean column to `users` table (default false).
- Once a user verifies channel membership, this flag is set to true.
- The app checks this flag first — if true, the channel gate is skipped entirely.
- This prevents the gate from showing on every tab open / mini app launch for users who already joined.

### 2. Referral Reward Settings Update
- Updates `referral_join_reward` from '25' to '250' (V2 coin system)
- Updates `referral_first_ads_reward` from '50' to '500' (V2 coin system)
- Updates `referral_second_day_reward` from '75' to '750' (V2 coin system)
- These settings now match the actual reward amounts (250/500/750) used in the V2 code.

## Security
- No RLS policy changes.
- No data deleted.
*/

ALTER TABLE users ADD COLUMN IF NOT EXISTS channels_verified boolean NOT NULL DEFAULT false;

INSERT INTO app_settings (key, value) VALUES ('referral_join_reward', '250')
ON CONFLICT (key) DO UPDATE SET value = '250';
INSERT INTO app_settings (key, value) VALUES ('referral_first_ads_reward', '500')
ON CONFLICT (key) DO UPDATE SET value = '500';
INSERT INTO app_settings (key, value) VALUES ('referral_second_day_reward', '750')
ON CONFLICT (key) DO UPDATE SET value = '750';
