
CREATE POLICY "users_can_view_own_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
