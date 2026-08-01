-- ============================================================================
-- Lumen — one-time database setup for a self-hosted Supabase project.
-- Run this ONCE in your own Supabase project: Dashboard → SQL Editor → New query
-- → paste the whole file → Run.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

create extension if not exists vector;

-- ---------------------------------------------------------------- documents --
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'pdf',
  mime_type   text,
  size_bytes  bigint not null default 0,
  status      text not null default 'uploaded',
  stage       text,
  error       text,
  pages       integer not null default 0,
  storage_path text,
  owner_id    uuid,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ chunks --
create table if not exists public.chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  page        integer not null default 1,
  idx         integer not null default 0,
  content     text not null,
  embedding   vector(3072),
  owner_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists chunks_document_idx on public.chunks (document_id);
create index if not exists chunks_owner_idx    on public.chunks (owner_id);
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- ---------------------------------------------------------------- entities --
create table if not exists public.entities (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  name          text not null,
  canonical_key text not null unique,
  risk_level    text not null default 'low',
  summary       text,
  metadata      jsonb not null default '{}'::jsonb,
  document_id   uuid references public.documents(id) on delete set null,
  page          integer,
  mentions      integer not null default 1,
  owner_id      uuid,
  created_at    timestamptz not null default now()
);

create index if not exists entities_type_idx  on public.entities (type);
create index if not exists entities_owner_idx on public.entities (owner_id);

-- ----------------------------------------------------------- relationships --
create table if not exists public.relationships (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references public.entities(id) on delete cascade,
  target_id   uuid not null references public.entities(id) on delete cascade,
  type        text not null,
  confidence  double precision not null default 0.7,
  evidence    text,
  document_id uuid references public.documents(id) on delete set null,
  page        integer,
  owner_id    uuid,
  created_at  timestamptz not null default now(),
  unique (source_id, target_id, type)
);

create index if not exists relationships_source_idx on public.relationships (source_id);
create index if not exists relationships_target_idx on public.relationships (target_id);
create index if not exists relationships_owner_idx  on public.relationships (owner_id);

-- ---------------------------------------------------------------- findings --
create table if not exists public.findings (
  id          uuid primary key default gen_random_uuid(),
  severity    text not null default 'medium',
  title       text not null,
  detail      text,
  category    text,
  entity_id   uuid references public.entities(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  page        integer,
  owner_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists findings_owner_idx on public.findings (owner_id);

-- --------------------------------------------------------------- questions --
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  question    text not null,
  answer      text,
  confidence  double precision not null default 0,
  refused     boolean not null default false,
  reasoning   text,
  citations   jsonb not null default '[]'::jsonb,
  graph_nodes jsonb not null default '[]'::jsonb,
  owner_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists questions_owner_idx on public.questions (owner_id);

-- ------------------------------------------------------- semantic search fn --
create or replace function public.match_chunks(
  query_embedding vector,
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  document_name text,
  page integer,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select c.id, c.document_id, d.name, c.page, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity
  from public.chunks c
  join public.documents d on d.id = c.document_id
  where c.embedding is not null
  order by c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;

-- ============================================================================
-- ACCESS RULES
--
-- This mirrors the current app: a shared, open demo corpus with no sign-in.
-- ANYONE WITH YOUR PUBLIC URL CAN READ AND DELETE EVERYTHING.
-- Fine for a demo or a private link; not fine for real compliance documents.
-- To lock it down, drop the `to anon` grants below and add a login flow.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array['documents','chunks','entities','relationships','findings','questions']
  loop
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "demo open access" on public.%I', t);
    execute format(
      'create policy "demo open access" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant execute on function public.match_chunks(vector, integer) to anon, authenticated, service_role;

-- ============================================================================
-- STORAGE
--
-- First create a PRIVATE bucket named `documents`:
--   Dashboard → Storage → New bucket → name: documents → Public: OFF → Create
-- Then this block wires up matching access rules.
-- ============================================================================

drop policy if exists "documents demo read"   on storage.objects;
drop policy if exists "documents demo write"  on storage.objects;
drop policy if exists "documents demo update" on storage.objects;
drop policy if exists "documents demo delete" on storage.objects;

create policy "documents demo read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'documents');
create policy "documents demo write" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'documents');
create policy "documents demo update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'documents');
create policy "documents demo delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'documents');