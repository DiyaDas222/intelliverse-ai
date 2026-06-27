
ALTER TABLE public.vibe_projects
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS deploy_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS deployed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deploy_logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

-- Backfill slugs for any existing rows
UPDATE public.vibe_projects
SET slug = lower(regexp_replace(coalesce(name,'site') || '-' || substr(id::text, 1, 8), '[^a-z0-9-]+', '-', 'g'))
WHERE slug IS NULL;

-- Public read policy: anyone (including anon) can read deployed projects by slug.
DROP POLICY IF EXISTS "Public can view deployed vibe projects" ON public.vibe_projects;
CREATE POLICY "Public can view deployed vibe projects"
ON public.vibe_projects
FOR SELECT
TO anon, authenticated
USING (deploy_status = 'deployed');

GRANT SELECT ON public.vibe_projects TO anon;
