-- Add 'pro' role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pro';

-- GitHub connections (one per user). Tokens stored server-side only; never read from client.
CREATE TABLE public.github_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_username TEXT NOT NULL,
  github_user_id BIGINT,
  access_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'pat',
  scopes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_connections TO authenticated;
GRANT ALL ON public.github_connections TO service_role;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own github connection"
ON public.github_connections FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_github_connections_updated_at
BEFORE UPDATE ON public.github_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Publish history
CREATE TABLE public.publish_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_id TEXT,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  is_private BOOLEAN NOT NULL DEFAULT true,
  commit_sha TEXT,
  repo_url TEXT NOT NULL,
  file_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  pro_at_publish BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_history TO authenticated;
GRANT ALL ON public.publish_history TO service_role;
ALTER TABLE public.publish_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own publish history"
ON public.publish_history FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own publish history"
ON public.publish_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_publish_history_user ON public.publish_history(user_id, created_at DESC);