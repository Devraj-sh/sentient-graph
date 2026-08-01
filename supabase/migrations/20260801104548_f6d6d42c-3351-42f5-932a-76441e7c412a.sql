CREATE POLICY "demo documents read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'documents');
CREATE POLICY "demo documents insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "demo documents update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
CREATE POLICY "demo documents delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'documents');