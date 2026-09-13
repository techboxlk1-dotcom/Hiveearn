-- Hive Earn - Balance Audit Evidence Log
-- Step 4A
-- IMPORTANT:
-- This migration does NOT change user balances.
-- It does NOT automatically ban users.

CREATE TABLE IF NOT EXISTS public.balance_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL
    REFERENCES public.users(id)
    ON DELETE CASCADE,

  actual_balance numeric NOT NULL DEFAULT 0,
  expected_balance numeric NOT NULL DEFAULT 0,
  balance_difference numeric NOT NULL DEFAULT 0,

  -- Breakdown of where the expected balance came from.
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- informational / warning / critical
  severity text NOT NULL DEFAULT 'informational',

  -- open / reviewed / confirmed_fraud / false_positive
  status text NOT NULL DEFAULT 'open',

  reviewed_by uuid NULL
    REFERENCES public.users(id)
    ON DELETE SET NULL,

  reviewed_at timestamptz NULL,

  notes text NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_balance_audit_logs_user_id
  ON public.balance_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_balance_audit_logs_status
  ON public.balance_audit_logs(status);

CREATE INDEX IF NOT EXISTS idx_balance_audit_logs_severity
  ON public.balance_audit_logs(severity);

CREATE INDEX IF NOT EXISTS idx_balance_audit_logs_created_at
  ON public.balance_audit_logs(created_at DESC);

-- Prevent accidental duplicate audit records for the exact
-- same user/balance snapshot/evidence timestamp combination.
CREATE INDEX IF NOT EXISTS idx_balance_audit_logs_user_snapshot
  ON public.balance_audit_logs(
    user_id,
    actual_balance,
    expected_balance,
    created_at
  );

-- RLS enabled.
ALTER TABLE public.balance_audit_logs ENABLE ROW LEVEL SECURITY;

-- No public/anon direct INSERT/UPDATE/DELETE policies are created here.
-- Audit records should be written by trusted server-side code only.

-- Admin/service-role access can be handled by the trusted server layer.
