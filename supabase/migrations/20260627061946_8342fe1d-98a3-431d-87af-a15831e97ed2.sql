
-- 1) Restrict EXECUTE on has_role; keep authenticated (RLS policies call it) but remove PUBLIC/anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2) Storage UPDATE policies for documents and generations buckets
CREATE POLICY "documents_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own generations"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Restrictive policies on user_roles for UPDATE and DELETE — only admins
CREATE POLICY "user_roles_block_non_admin_update"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "user_roles_block_non_admin_delete"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
