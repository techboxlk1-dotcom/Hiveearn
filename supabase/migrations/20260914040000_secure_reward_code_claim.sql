BEGIN;

-- ============================================================
-- Secure Reward Code Claim
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_reward_code(
  p_user_id uuid,
  p_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_code public.reward_codes%ROWTYPE;
  v_claim_id uuid;
  v_amount numeric;
  v_new_balance numeric;
BEGIN

  -- ----------------------------------------------------------
  -- Basic validation
  -- ----------------------------------------------------------

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'Invalid user.'
    );
  END IF;

  IF p_code IS NULL OR trim(p_code) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'Please enter a reward code.'
    );
  END IF;


  -- ----------------------------------------------------------
  -- Lock user row
  -- ----------------------------------------------------------

  SELECT *
  INTO v_user
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'User account not found.'
    );
  END IF;


  -- ----------------------------------------------------------
  -- Security checks
  -- ----------------------------------------------------------

  IF COALESCE(v_user.permanent_ban, false) = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message',
      '🚫 Your account is permanently banned. Reason: ' ||
      COALESCE(v_user.permanent_ban_reason, 'Security violation')
    );
  END IF;

  IF COALESCE(v_user.security_lock, false) = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', '🔒 Your account is security locked.'
    );
  END IF;

  IF COALESCE(v_user.is_suspended, false) = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message',
      '🚫 Your account is suspended. Reason: ' ||
      COALESCE(v_user.suspension_reason, 'Account suspended')
    );
  END IF;


  -- ----------------------------------------------------------
  -- Find and LOCK reward code
  -- ----------------------------------------------------------

  SELECT *
  INTO v_code
  FROM public.reward_codes
  WHERE upper(code) = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'Invalid reward code'
    );
  END IF;


  -- ----------------------------------------------------------
  -- Code validation
  -- ----------------------------------------------------------

  IF v_code.is_active = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'This code is no longer active'
    );
  END IF;

  IF v_code.expires_at IS NOT NULL
     AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'Code has expired'
    );
  END IF;

  IF v_code.usage_limit IS NOT NULL
     AND v_code.usage_count >= v_code.usage_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'Code usage limit reached'
    );
  END IF;

  IF v_code.reward_amount IS NULL
     OR v_code.reward_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'Invalid reward code configuration'
    );
  END IF;


  -- ----------------------------------------------------------
  -- Duplicate claim protection
  -- ----------------------------------------------------------

  IF EXISTS (
    SELECT 1
    FROM public.reward_code_claims
    WHERE user_id = p_user_id
      AND reward_code_id = v_code.id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'You already claimed this code'
    );
  END IF;


  -- ----------------------------------------------------------
  -- Server-side reward amount
  -- NEVER trust client reward amount
  -- ----------------------------------------------------------

  v_amount := v_code.reward_amount;


  -- ----------------------------------------------------------
  -- Claim record
  -- ----------------------------------------------------------

  INSERT INTO public.reward_code_claims (
    user_id,
    reward_code_id,
    hive_earned
  )
  VALUES (
    p_user_id,
    v_code.id,
    v_amount
  )
  RETURNING id INTO v_claim_id;


  -- ----------------------------------------------------------
  -- Increment usage count
  -- ----------------------------------------------------------

  UPDATE public.reward_codes
  SET
    usage_count = usage_count + 1,
    updated_at = now()
  WHERE id = v_code.id;


  -- ----------------------------------------------------------
  -- Secure balance update
  -- Uses the already protected balance RPC.
  -- The public execute permission was revoked in Step 4D,
  -- but this SECURITY DEFINER function can call it internally.
  -- ----------------------------------------------------------

  v_new_balance := public.change_hive_balance(
    p_user_id,
    v_amount,
    'reward_code',
    '⚡ Reward code: ' || upper(trim(p_code)),
    v_claim_id
  );


  -- ----------------------------------------------------------
  -- Success
  -- ----------------------------------------------------------

  RETURN jsonb_build_object(
    'success', true,
    'hive', v_amount,
    'new_balance', v_new_balance,
    'claim_id', v_claim_id,
    'message', '+' || v_amount || ' Hive earned!'
  );

EXCEPTION
  WHEN unique_violation THEN

    RETURN jsonb_build_object(
      'success', false,
      'hive', 0,
      'message', 'You already claimed this code'
    );

  WHEN OTHERS THEN

    RAISE;
END;
$$;


-- ------------------------------------------------------------
-- IMPORTANT:
-- Only this reward-code RPC is exposed to the client.
-- The dangerous balance RPC remains locked.
-- ------------------------------------------------------------

REVOKE EXECUTE
ON FUNCTION public.claim_reward_code(uuid, text)
FROM PUBLIC;

REVOKE EXECUTE
ON FUNCTION public.claim_reward_code(uuid, text)
FROM anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.claim_reward_code(uuid, text)
TO anon, authenticated;


COMMIT;
