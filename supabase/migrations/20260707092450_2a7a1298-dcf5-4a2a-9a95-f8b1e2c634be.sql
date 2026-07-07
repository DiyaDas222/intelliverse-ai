-- 1) Plans catalog
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_paise int NOT NULL CHECK (price_paise >= 100),
  currency text NOT NULL DEFAULT 'INR',
  duration_days int NOT NULL CHECK (duration_days > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_public_read ON public.plans FOR SELECT USING (is_active = true);

INSERT INTO public.plans (id, name, description, price_paise, duration_days, sort_order, features) VALUES
  ('pro-monthly','Pro Monthly','Unlock everything for a month',49900,30,1,
    '["Unlimited AI chat","Unlimited image/audio/music/video generations","Unlimited Vibe Coding projects","Publish clean projects to GitHub","Priority AI responses","Pro Verified badge"]'::jsonb),
  ('pro-yearly','Pro Yearly','2 months free vs monthly',499900,365,2,
    '["Everything in Pro Monthly","2 months free","Early access to new features"]'::jsonb);

-- 2) Payments (invoice history)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  razorpay_order_id text NOT NULL UNIQUE,
  razorpay_payment_id text UNIQUE,
  amount_paise int NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created',
  environment text NOT NULL DEFAULT 'test',
  captured_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_own_read ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_payments_user_created ON public.payments (user_id, created_at DESC);

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Extend subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id text REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_payment_id ON public.subscriptions(payment_id) WHERE payment_id IS NOT NULL;

-- 4) has_active_pro helper
CREATE OR REPLACE FUNCTION public.has_active_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND (current_period_end IS NULL OR current_period_end > now())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_active_pro(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_pro(uuid) TO authenticated, service_role;

-- 5) Usage counters
CREATE TABLE public.usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('chat','generation','vibe')),
  period_key text NOT NULL,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, period_key)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_own_read ON public.usage_counters FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6) Atomic increment + free-tier gate
CREATE OR REPLACE FUNCTION public.increment_usage(_user_id uuid, _kind text, _free_limit int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
  _is_pro boolean := public.has_active_pro(_user_id);
  _new_count int;
BEGIN
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
REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, text, int) TO authenticated, service_role;