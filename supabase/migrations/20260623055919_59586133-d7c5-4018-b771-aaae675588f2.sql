
CREATE POLICY "Users upload own generations" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read own generations" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own generations" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'generations' AND (storage.foldername(name))[1] = auth.uid()::text);
