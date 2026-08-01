-- Documents
DROP POLICY IF EXISTS "Owners manage their documents" ON public.documents;
DROP POLICY IF EXISTS "Owners manage their chunks" ON public.chunks;
DROP POLICY IF EXISTS "Owners manage their entities" ON public.entities;
DROP POLICY IF EXISTS "Owners manage their relationships" ON public.relationships;
DROP POLICY IF EXISTS "Owners manage their findings" ON public.findings;
DROP POLICY IF EXISTS "Owners manage their questions" ON public.questions;

ALTER TABLE public.documents ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.chunks ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.entities ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.relationships ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.findings ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN owner_id DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chunks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationships TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT ALL ON public.documents, public.chunks, public.entities, public.relationships, public.findings, public.questions TO service_role;

CREATE POLICY "demo open access" ON public.documents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.chunks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.entities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.relationships FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.findings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Entity de-duplication back to a global canonical key
ALTER TABLE public.entities DROP CONSTRAINT IF EXISTS entities_owner_canonical_key_key;
ALTER TABLE public.entities DROP CONSTRAINT IF EXISTS entities_canonical_key_key;
ALTER TABLE public.entities ADD CONSTRAINT entities_canonical_key_key UNIQUE (canonical_key);

-- Vector search callable without a session
CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_count integer DEFAULT 8)
RETURNS TABLE(id uuid, document_id uuid, document_name text, page integer, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.document_id, d.name, c.page, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.chunks c
  JOIN public.documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$function$;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer) TO anon, authenticated, service_role;

-- Storage: open demo access to the documents bucket
DROP POLICY IF EXISTS "Owners read their documents" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload their documents" ON storage.objects;
DROP POLICY IF EXISTS "Owners update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete their documents" ON storage.objects;
DROP POLICY IF EXISTS "demo documents read" ON storage.objects;
DROP POLICY IF EXISTS "demo documents insert" ON storage.objects;
DROP POLICY IF EXISTS "demo documents update" ON storage.objects;
DROP POLICY IF EXISTS "demo documents delete" ON storage.objects;

CREATE POLICY "demo documents read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'documents');
CREATE POLICY "demo documents insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "demo documents update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
CREATE POLICY "demo documents delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'documents');