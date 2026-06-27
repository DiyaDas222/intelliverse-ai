-- Add 'team' to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team';

-- Bonus credits on profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bonus_credits integer NOT NULL DEFAULT 0;

-- Admin notifications feed
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can mark notifications read"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at
  ON public.admin_notifications (created_at DESC);