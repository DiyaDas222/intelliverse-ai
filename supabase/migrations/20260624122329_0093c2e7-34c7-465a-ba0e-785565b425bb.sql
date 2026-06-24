-- 1. asset_shares: drop the overly permissive public SELECT policy.
-- Public share access goes through /api/public/share/$token which uses the service-role client.
DROP POLICY IF EXISTS "Anyone can read non-expired share links by token" ON public.asset_shares;

-- 2. provider_configs: restrict SELECT to admins only (matches write policy).
DROP POLICY IF EXISTS "provider_configs_select_all" ON public.provider_configs;
CREATE POLICY "provider_configs_admin_select"
ON public.provider_configs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. user_roles: add an explicit RESTRICTIVE policy so only admins can ever INSERT,
-- closing any future accidental permissive-INSERT-policy gap.
DROP POLICY IF EXISTS "user_roles_block_non_admin_insert" ON public.user_roles;
CREATE POLICY "user_roles_block_non_admin_insert"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. has_role: revoke EXECUTE from anon and PUBLIC; keep it for authenticated
-- (required because RLS policies on multiple tables call has_role(auth.uid(), ...)).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;