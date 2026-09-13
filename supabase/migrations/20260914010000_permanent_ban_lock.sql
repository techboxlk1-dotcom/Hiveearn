-- ============================================================
-- Hive Earn - Permanent Fraud Ban Lock
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_permanent_ban_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- Once permanently banned, the security fields can NEVER
  -- be changed back to an unbanned state.
  IF OLD.permanent_ban = true THEN

    NEW.permanent_ban := true;
    NEW.security_lock := true;
    NEW.is_suspended := true;
    NEW.manually_unsuspended := false;

    -- Keep the original permanent-ban information
    IF NEW.permanent_ban_reason IS NULL THEN
      NEW.permanent_ban_reason := OLD.permanent_ban_reason;
    END IF;

    IF NEW.permanently_banned_at IS NULL THEN
      NEW.permanently_banned_at := OLD.permanently_banned_at;
    END IF;

    IF NEW.suspension_reason IS NULL THEN
      NEW.suspension_reason := OLD.suspension_reason;
    END IF;

    -- Permanently banned users cannot mine
    NEW.mining_started_at := NULL;

  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS enforce_permanent_ban_lock_trigger
ON public.users;


CREATE TRIGGER enforce_permanent_ban_lock_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_permanent_ban_lock();
