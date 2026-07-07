DROP POLICY IF EXISTS "Public can view deployed vibe projects" ON public.vibe_projects;
REVOKE SELECT ON public.vibe_projects FROM anon;