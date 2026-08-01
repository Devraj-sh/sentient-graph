# Lumen — GraphRAG Compliance Intelligence

An enterprise compliance platform that ingests documents, extracts entities and relationships with AI, builds a knowledge graph, and answers compliance questions with citations and confidence — refusing to answer when evidence is weak.

Built on the supported stack: TanStack Start (React + TypeScript + Tailwind + shadcn), Lovable Cloud (Postgres + pgvector + storage + server functions), Lovable AI (Gemini for extraction, answers, OCR, transcription).

## Stack mapping

| Requested | Built as |
| --- | --- |
| Next.js 15 | TanStack Start (React 19 + TS) |
| FastAPI backend | Server functions + server routes |
| Neo4j | Postgres graph tables (`entities`, `relationships`) with recursive traversal |
| Qdrant | pgvector on `chunks` |
| Gemini 2.5 Pro / embeddings | Lovable AI: `google/gemini-3.6-flash` + `google/gemini-embedding-001` |
| PyMuPDF / Tesseract / Whisper | Client PDF+CSV/XLSX parsing, Gemini vision OCR, Lovable AI transcription |
| React Flow | Custom SVG/canvas force-directed graph viewer |

## Phase 1 — Shell, design system, demo login

- Dark enterprise design system in `src/styles.css`: deep slate base, teal/amber accents for risk states, glass cards, gradients — no default purple-on-white.
- Demo login screen at `/` with branding; entering the app sets a local demo session and routes to `/dashboard`.
- App shell: sidebar nav (Dashboard, Upload, Graph, Chat, Compliance, Search), topbar with global search, skeleton loaders everywhere.

## Phase 2 — Cloud backend

Enable Lovable Cloud. Tables:

```text
documents(id, name, type, size, status, pages, storage_path, created_at)
chunks(id, document_id, page, text, embedding vector(3072))
entities(id, type, name, canonical_key, risk_level, metadata, document_id, page)
relationships(id, source_id, target_id, type, confidence, document_id, page)
questions(id, question, answer, confidence, citations jsonb, created_at)
findings(id, severity, title, detail, entity_id, created_at)
```

Storage bucket `documents` (private) with signed-URL downloads for citations. HNSW index on chunk embeddings; grants + RLS on every table (demo-open read/write since there is no real auth, documented in security memory).

## Phase 3 — Upload + processing pipeline

- Drag-and-drop upload with per-file progress, previews, size/type validation, filename sanitization.
- PDF → text per page (pdfjs-dist), CSV/XLSX → rows flattened to text, images → Gemini vision OCR, audio → Lovable AI transcription (`openai/gpt-4o-mini-transcribe`).
- Server function chunks text (~1200 chars, overlap), embeds via `google/gemini-embedding-001`, stores chunks with page numbers.
- Live processing status timeline per file: Extract → OCR/STT → Chunk → Embed → Extract entities → Graph.

## Phase 4 — Entity extraction + graph build

- Gemini structured output extracts Person, Organization, Department, Policy, Law, Rule, Document, Amount, Date, Country, Vendor, Asset, Risk plus typed relationships (APPROVED, BELONGS_TO, REGULATED_BY, VIOLATES, OWNS, REPORTS_TO, …), each with source document + page.
- Entity resolution by normalized canonical key so the same vendor across files becomes one node.

## Phase 5 — Graph viewer

- Interactive force-directed graph: zoom, pan, search, expand/collapse neighbors, color per entity type, edge labels.
- Node click panel: metadata, connected nodes, source document, page number, jump to source.

## Phase 6 — GraphRAG chat

- Retrieval: vector search over chunks + graph traversal from matched entities (1–2 hops), merge and rank evidence by similarity, graph proximity, and recency.
- Gemini answers from ranked evidence only, streaming into a ChatGPT-style interface with suggested prompts and conversation history (localStorage-backed single conversation, one-shot per session).
- Hallucination guard: below the confidence threshold the app returns "I could not find enough supporting evidence." and never calls the model for a fabricated answer.
- Every answer renders citation cards: document, page, exact paragraph, confidence, download source. Graph nodes used in the answer are highlighted in the viewer.

## Phase 7 — Dashboard, compliance, analytics, insights, search

- Dashboard KPIs: files, nodes, relationships, compliance score, risk score; recent uploads, recent questions, charts.
- Compliance page: score, violations, risk alerts, top risky departments, findings timeline.
- Analytics: entity distribution pie, relationships bar, upload timeline, risk heatmap (Recharts).
- AI Insights: executive summary, risk summary, gaps, recommendations, most connected entities.
- Global search across entities, documents, relationships, policies.

## Phase 8 — Polish

- Motion transitions, responsive layouts, error/empty/loading states, per-route SEO metadata, README with architecture, GraphRAG explanation, run steps, and the demo script (upload → process → graph → "Which vendor violates AML policy?" → cited answer).

## Notes

- Demo login is a client-side gate, not real auth — anyone with the URL can reach the data. Real accounts can be added later.
- Phases ship in order and the app stays runnable after each one; I will build Phases 1–6 (the ingest → graph → chat demo path) first, then 7–8.
