BEGIN;

-- Hive Earn
-- Step 4D: Lock sensitive balance/security RPCs
--
-- These functions must NOT be callable directly by
-- anonymous or normal authenticated clients.
--
-- Balance changes and permanent bans must happen only
-- through trusted server-side execution.

REVOKE EXECUTE
ON FUNCTION public.change_hive_balance(
  uuid,
  numeric,
  text,
  text,
  uuid
)
FROM anon, authenticated;

REVOKE EXECUTE
ON FUNCTION public.permanent_ban_user(
  uuid,
  text
)
FROM anon, authenticated;

-- Explicitly keep public execution disabled.
REVOKE EXECUTE
ON FUNCTION public.change_hive_balance(
  uuid,
  numeric,
  text,
  text,
  uuid
)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.permanent_ban_user(
  uuid,
  text
)
FROM PUBLIC;

COMMIT;
