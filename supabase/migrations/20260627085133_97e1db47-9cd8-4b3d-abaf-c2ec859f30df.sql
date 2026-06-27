
CREATE TABLE public.vibe_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'website',
  stack JSONB NOT NULL DEFAULT '{}'::jsonb,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  entry_file TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vibe_projects TO authenticated;
GRANT ALL ON public.vibe_projects TO service_role;

ALTER TABLE public.vibe_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vibe projects"
  ON public.vibe_projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX vibe_projects_user_idx ON public.vibe_projects(user_id, updated_at DESC);

CREATE TRIGGER vibe_projects_updated_at
  BEFORE UPDATE ON public.vibe_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
