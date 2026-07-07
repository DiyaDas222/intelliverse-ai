DROP FUNCTION IF EXISTS public.increment_usage(uuid, text, int);

CREATE OR REPLACE FUNCTION public.increment_usage(_kind text, _free_limit int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
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
REVOKE EXECUTE ON FUNCTION public.increment_usage(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage(text, int) TO authenticated, service_role;