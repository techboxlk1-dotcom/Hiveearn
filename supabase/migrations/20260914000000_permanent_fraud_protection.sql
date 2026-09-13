-- ============================================================
-- HIVE EARN - PERMANENT FRAUD PROTECTION
-- ============================================================

-- Permanent ban fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS permanent_ban boolean NOT NULL DEFAULT false;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS permanent_ban_reason text;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS permanently_banned_at timestamptz;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS security_lock boolean NOT NULL DEFAULT false;


-- ============================================================
-- PERMANENT BAN
-- ============================================================

CREATE OR REPLACE FUNCTION permanent_ban_user(
  p_user_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- Never auto-ban admin accounts
  IF EXISTS (
    SELECT 1
    FROM users
    WHERE id = p_user_id
    AND is_admin = true
  ) THEN
    RETURN false;
  END IF;

  UPDATE users
  SET
    is_suspended = true,
    permanent_ban = true,
    security_lock = true,
    suspension_reason = p_reason,
    permanent_ban_reason = p_reason,
    permanently_banned_at = NOW(),
    manually_unsuspended = false,
    mining_started_at = NULL
  WHERE id = p_user_id;

  INSERT INTO fraud_logs (
    user_id,
    type,
    description,
    severity
  )
  VALUES (
    p_user_id,
    'other',
    'PERMANENT BAN: ' || p_reason,
    'critical'
  );

  RETURN true;
END;
$$;


-- ============================================================
-- PROTECT PERMANENT BANNED USERS
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_permanent_ban_bypass()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN

  IF OLD.permanent_ban = true THEN

    IF NEW.permanent_ban = false
       OR NEW.security_lock = false
       OR NEW.is_suspended = false
       OR NEW.manually_unsuspended = true THEN

      RAISE EXCEPTION
        'PERMANENTLY BANNED ACCOUNT CANNOT BE RESTORED';

    END IF;

  END IF;

  RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS prevent_permanent_ban_bypass_trigger
ON users;

CREATE TRIGGER prevent_permanent_ban_bypass_trigger

BEFORE UPDATE ON users

FOR EACH ROW

EXECUTE FUNCTION prevent_permanent_ban_bypass();


-- ============================================================
-- PREVENT COMPLETED TRANSACTION TAMPERING
-- ============================================================

CREATE OR REPLACE FUNCTION protect_completed_transactions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN

  IF TG_OP = 'DELETE' THEN

    IF OLD.status = 'completed' THEN
      RAISE EXCEPTION
        'COMPLETED TRANSACTION CANNOT BE DELETED';
    END IF;

    RETURN OLD;
  END IF;


  IF OLD.status = 'completed' THEN

    IF NEW.user_id <> OLD.user_id
       OR NEW.amount <> OLD.amount
       OR NEW.type <> OLD.type
       OR NEW.created_at <> OLD.created_at THEN

      RAISE EXCEPTION
        'COMPLETED TRANSACTION CANNOT BE MODIFIED';

    END IF;

  END IF;

  RETURN NEW;

END;
$$;


DROP TRIGGER IF EXISTS protect_completed_transactions_trigger
ON transactions;

CREATE TRIGGER protect_completed_transactions_trigger

BEFORE UPDATE OR DELETE ON transactions

FOR EACH ROW

EXECUTE FUNCTION protect_completed_transactions();


-- ============================================================
-- UNIQUE DAILY BONUS
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
idx_one_daily_bonus_per_user_day

ON daily_bonus_claims (
  user_id,
  ((claimed_at AT TIME ZONE 'UTC')::date)
);


-- ============================================================
-- UNIQUE WEBSITE VISIT PER DAY
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
idx_one_website_visit_per_user_day

ON website_visits (
  user_id,
  website_id,
  ((visited_at AT TIME ZONE 'UTC')::date)
);


-- ============================================================
-- SECURITY INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
idx_users_permanent_ban
ON users(permanent_ban);

CREATE INDEX IF NOT EXISTS
idx_users_security_lock
ON users(security_lock);

CREATE INDEX IF NOT EXISTS
idx_fraud_logs_severity
ON fraud_logs(severity);

CREATE INDEX IF NOT EXISTS
idx_ad_watches_user_provider
ON ad_watches(user_id, provider_id);

CREATE INDEX IF NOT EXISTS
idx_transactions_user_status
ON transactions(user_id, status);
