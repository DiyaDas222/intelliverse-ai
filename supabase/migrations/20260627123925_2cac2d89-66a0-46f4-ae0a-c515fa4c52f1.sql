
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_credits_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_period_start timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION private.plan_monthly_allowance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'team') THEN 5000
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'pro')  THEN 1000
    ELSE 25
  END;
$$;

CREATE OR REPLACE FUNCTION private.consume_credits(_user_id uuid, _amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_used    integer;
  v_start   timestamptz;
  v_bonus   integer;
  v_allow   integer;
  v_remain  integer;
  v_take_m  integer;
  v_take_b  integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'remaining', 0);
  END IF;

  SELECT monthly_credits_used, credits_period_start, COALESCE(bonus_credits, 0)
    INTO v_used, v_start, v_bonus
  FROM public.profiles WHERE id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, monthly_credits_used, credits_period_start, bonus_credits)
    VALUES (_user_id, 0, now(), 0)
    ON CONFLICT (id) DO NOTHING;
    v_used := 0; v_start := now(); v_bonus := 0;
  END IF;

  IF v_start IS NULL OR v_start < now() - interval '30 days' THEN
    v_used := 0;
    v_start := now();
  END IF;

  v_allow := private.plan_monthly_allowance(_user_id);
  v_remain := GREATEST(v_allow - v_used, 0) + v_bonus;

  IF v_remain < _amount THEN
    RETURN jsonb_build_object('ok', false, 'remaining', v_remain, 'allowance', v_allow, 'used', v_used, 'bonus', v_bonus);
  END IF;

  v_take_m := LEAST(_amount, GREATEST(v_allow - v_used, 0));
  v_take_b := _amount - v_take_m;

  UPDATE public.profiles
     SET monthly_credits_used = v_used + v_take_m,
         credits_period_start = v_start,
         bonus_credits        = COALESCE(bonus_credits, 0) - v_take_b
   WHERE id = _user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'remaining', v_remain - _amount,
    'allowance', v_allow,
    'used', v_used + v_take_m,
    'bonus', v_bonus - v_take_b
  );
END;
$$;

GRANT EXECUTE ON FUNCTION private.consume_credits(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.plan_monthly_allowance(uuid)   TO service_role;
