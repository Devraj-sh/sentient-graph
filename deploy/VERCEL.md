# Deploying Lumen to Vercel with your own backend

The app now reads its backend and AI credentials from environment variables, so
the same codebase runs on Lovable (Lovable Cloud + Lovable AI) and on Vercel
(your Supabase project + your Gemini key). Nothing here changes the Lovable
version — it keeps working exactly as before.

---

## 1. Create your Supabase project

1. Sign up at <https://supabase.com> and create a new project (the free tier is
   enough). Pick a region close to your users.
2. Wait for it to finish provisioning (~2 minutes).
3. Go to **Storage → New bucket**, name it exactly `documents`, leave
   **Public** switched **off**, and create it.
4. Go to **SQL Editor → New query**, paste the entire contents of
   [`deploy/supabase-setup.sql`](./supabase-setup.sql), and click **Run**.
   This creates the six tables, the pgvector index, the semantic-search
   function and the access rules.

> The setup script reproduces today's **open demo access** — anyone with your
> URL can read and delete all documents and answers. That's deliberate (the app
> has no login), but do not put confidential documents behind a public URL.

### Collect your keys

**Settings → API** in the Supabase dashboard:

| Dashboard field | You'll need it as |
| --- | --- |
| Project URL | `SUPABASE_URL` and `VITE_SUPABASE_URL` |
| `anon` / publishable key | `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `service_role` key (click to reveal) | `SUPABASE_SERVICE_ROLE_KEY` |

The `service_role` key bypasses all access rules. It is server-only — never
give it a `VITE_` prefix and never commit it.

## 2. Get a Gemini API key

1. Open <https://aistudio.google.com/apikey>.
2. **Create API key** → copy it. This becomes `GEMINI_API_KEY`.

It powers all four AI steps: entity/relationship extraction, 3072-dimension
embeddings, scanned-page OCR and audio transcription. When `GEMINI_API_KEY` is
set it takes priority, so a Vercel deploy is never billed to a Lovable
workspace.

## 3. Deploy

1. Push this project to GitHub (Lovable → GitHub → Connect, if you haven't).
2. On <https://vercel.com>, **Add New → Project** and import the repository.
3. Leave the framework preset on **Other** — the build auto-detects Vercel and
   emits the right output. Build command `npm run build`; no output directory
   override needed.
4. Add these **Environment Variables** before the first deploy:

```
VITE_SUPABASE_URL=https://<your-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_URL=https://<your-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
GEMINI_API_KEY=<your Gemini key>
```

5. **Deploy**.

The `VITE_*` pair is baked in at build time — after changing either one you
must **redeploy**, not just restart.

## 4. Verify

Open the deployed URL and upload a small PDF on the Ingestion page. You should
see the stage tracker walk through parsing → embedding → extracting → graphing,
then entities appear on the Knowledge Graph page and the chat answers with
citations.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Missing Supabase environment variable(s)` | A server variable is absent or was added after the build — add it and redeploy. |
| Upload fails immediately, before parsing | The `documents` bucket doesn't exist, or the storage rules in the setup script weren't run. |
| `AI key was rejected` | `GEMINI_API_KEY` is wrong, or the key's project has no Generative Language API access. |
| `Could not find the function public.match_chunks` | The setup SQL didn't finish — re-run it. |
| Chat answers but never cites anything | Documents were ingested before the vector index existed; re-upload them. |
| Blank page, console shows a Supabase error | The `VITE_*` pair is missing at build time — set both and redeploy. |

## Optional: pin the build target

Auto-detection handles Vercel. If you ever build from your own CI where the
platform isn't detectable, pin it in `vite.config.ts`:

```ts
export default defineConfig({
  nitro: { preset: "vercel" },
  tanstackStart: { server: { entry: "server" } },
});
```