
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.increment_usage(_user_id uuid, _kind text, _free_limit int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  _is_pro boolean;
  _new_count int;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'unauthenticated');
  END IF;
  IF _kind NOT IN ('chat','generation','vibe') THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'invalid_kind');
  END IF;
  _is_pro := public.has_active_pro(_user_id);
  INSERT INTO public.usage_counters (user_id, kind, period_key, count)
  VALUES (_user_id, _kind, _period, 1)
  ON CONFLICT (user_id, kind, period_key)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now()
  RETURNING count INTO _new_count;
  IF NOT _is_pro AND _free_limit IS NOT NULL AND _new_count > _free_limit THEN
    UPDATE public.usage_counters
      SET count = count - 1
      WHERE user_id = _user_id AND kind = _kind AND period_key = _period;
    RETURN jsonb_build_object('allowed', false, 'count', _new_count - 1, 'limit', _free_limit, 'is_pro', false, 'period', _period);
  END IF;
  RETURN jsonb_build_object('allowed', true, 'count', _new_count, 'limit', _free_limit, 'is_pro', _is_pro, 'period', _period);
END;
$$;
REVOKE ALL ON FUNCTION private.increment_usage(uuid, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.increment_usage(uuid, text, int) FROM anon;
GRANT EXECUTE ON FUNCTION private.increment_usage(uuid, text, int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT private.has_role(_user_id, _role);
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.increment_usage(text, int);
CREATE OR REPLACE FUNCTION public.increment_usage(_kind text, _free_limit int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'unauthenticated');
  END IF;
  RETURN private.increment_usage(_uid, _kind, _free_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.increment_usage(text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_usage(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_usage(text, int) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.consume_credits(uuid, int);
REVOKE ALL ON FUNCTION private.consume_credits(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.consume_credits(uuid, int) FROM anon;
REVOKE ALL ON FUNCTION private.consume_credits(uuid, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION private.consume_credits(uuid, int) TO service_role;
