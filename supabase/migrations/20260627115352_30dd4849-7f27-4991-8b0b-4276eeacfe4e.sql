-- Restrict vibe_projects policy to authenticated role
DROP POLICY IF EXISTS "Users manage own vibe projects" ON public.vibe_projects;
CREATE POLICY "Users manage own vibe projects" ON public.vibe_projects
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicitly deny client-side writes on subscriptions (service role bypasses RLS)
CREATE POLICY "Block client inserts on subscriptions" ON public.subscriptions
  AS RESTRICTIVE FOR INSERT TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "Block client updates on subscriptions" ON public.subscriptions
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "Block client deletes on subscriptions" ON public.subscriptions
  AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (false);