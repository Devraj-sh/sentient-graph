CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'pdf',
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'uploaded',
  stage text,
  error text,
  pages integer NOT NULL DEFAULT 0,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page integer NOT NULL DEFAULT 1,
  idx integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  canonical_key text NOT NULL UNIQUE,
  risk_level text NOT NULL DEFAULT 'low',
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  page integer,
  mentions integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  type text NOT NULL,
  confidence double precision NOT NULL DEFAULT 0.7,
  evidence text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  page integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, target_id, type)
);

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text,
  confidence double precision NOT NULL DEFAULT 0,
  refused boolean NOT NULL DEFAULT false,
  reasoning text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  graph_nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  detail text,
  category text,
  entity_id uuid REFERENCES public.entities(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  page integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chunks_document_idx ON public.chunks(document_id);
CREATE INDEX chunks_embedding_idx ON public.chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
CREATE INDEX entities_type_idx ON public.entities(type);
CREATE INDEX relationships_source_idx ON public.relationships(source_id);
CREATE INDEX relationships_target_idx ON public.relationships(target_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chunks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationships TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.findings TO anon, authenticated;
GRANT ALL ON public.documents, public.chunks, public.entities, public.relationships, public.questions, public.findings TO service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo open access" ON public.documents FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.chunks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.entities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.relationships FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo open access" ON public.findings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector(3072), match_count int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  document_name text,
  page integer,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id, c.document_id, d.name, c.page, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.chunks c
  JOIN public.documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, int) TO anon, authenticated, service_role;