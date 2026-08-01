-- Existing rows predate ownership and cannot be attributed; clear them.
TRUNCATE public.chunks, public.findings, public.relationships, public.entities, public.questions, public.documents CASCADE;

ALTER TABLE public.documents ADD COLUMN owner_id uuid NOT NULL;
ALTER TABLE public.chunks ADD COLUMN owner_id uuid NOT NULL;
ALTER TABLE public.entities ADD COLUMN owner_id uuid NOT NULL;
ALTER TABLE public.relationships ADD COLUMN owner_id uuid NOT NULL;
ALTER TABLE public.findings ADD COLUMN owner_id uuid NOT NULL;
ALTER TABLE public.questions ADD COLUMN owner_id uuid NOT NULL;

CREATE INDEX documents_owner_idx ON public.documents(owner_id);
CREATE INDEX chunks_owner_idx ON public.chunks(owner_id);
CREATE INDEX entities_owner_idx ON public.entities(owner_id);
CREATE INDEX relationships_owner_idx ON public.relationships(owner_id);
CREATE INDEX findings_owner_idx ON public.findings(owner_id);
CREATE INDEX questions_owner_idx ON public.questions(owner_id);

-- Entity de-duplication must be per owner, not global.
ALTER TABLE public.entities DROP CONSTRAINT entities_canonical_key_key;
ALTER TABLE public.entities ADD CONSTRAINT entities_owner_canonical_key_key UNIQUE (owner_id, canonical_key);

-- Replace the demo-open policies with owner-scoped ones.
DROP POLICY "demo open access" ON public.documents;
DROP POLICY "demo open access" ON public.chunks;
DROP POLICY "demo open access" ON public.entities;
DROP POLICY "demo open access" ON public.relationships;
DROP POLICY "demo open access" ON public.findings;
DROP POLICY "demo open access" ON public.questions;

REVOKE ALL ON public.documents, public.chunks, public.entities, public.relationships, public.findings, public.questions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents, public.chunks, public.entities, public.relationships, public.findings, public.questions TO authenticated;
GRANT ALL ON public.documents, public.chunks, public.entities, public.relationships, public.findings, public.questions TO service_role;

CREATE POLICY "Owners manage their documents" ON public.documents FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners manage their chunks" ON public.chunks FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners manage their entities" ON public.entities FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners manage their relationships" ON public.relationships FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners manage their findings" ON public.findings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners manage their questions" ON public.questions FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Vector search must respect RLS: run as the caller, not the definer.
CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_count integer DEFAULT 8)
RETURNS TABLE(id uuid, document_id uuid, document_name text, page integer, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.match_chunks(vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_chunks(vector, integer) TO authenticated, service_role;

-- Storage: private per-user folders inside the documents bucket.
DROP POLICY "demo documents read" ON storage.objects;
DROP POLICY "demo documents insert" ON storage.objects;
DROP POLICY "demo documents update" ON storage.objects;
DROP POLICY "demo documents delete" ON storage.objects;

CREATE POLICY "Owners read their document files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners upload their document files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners update their document files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners delete their document files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);