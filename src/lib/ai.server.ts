/**
 * Thin server-only AI wrapper. Never import from client code.
 *
 * Two interchangeable providers, chosen at runtime:
 *  - Lovable AI Gateway   (LOVABLE_API_KEY)  — used inside Lovable.
 *  - Google Gemini direct (GEMINI_API_KEY)   — used on Vercel / self-hosting.
 *
 * GEMINI_API_KEY wins when both are present, so a self-hosted deploy is
 * never silently billed to a Lovable workspace.
 */
type Provider = {
  kind: "lovable" | "gemini";
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  embeddingModel: string;
};

/** Resolved per call — env is only populated at request time. */
function provider(): Provider {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey) {
    return {
      kind: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: geminiKey,
      chatModel: process.env["GEMINI_CHAT_MODEL"] ?? "gemini-2.5-flash",
      embeddingModel: "gemini-embedding-001",
    };
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) {
    return {
      kind: "lovable",
      baseUrl: "https://ai.gateway.lovable.dev/v1",
      apiKey: lovableKey,
      chatModel: "google/gemini-3.6-flash",
      embeddingModel: "google/gemini-embedding-001",
    };
  }

  throw new Error(
    "AI is not configured. Set GEMINI_API_KEY (self-hosted) or LOVABLE_API_KEY.",
  );
}

/** Vector width the database column and index are built for. */
export const EMBEDDING_DIMENSIONS = 3072;

async function aiFetch(path: string, init: RequestInit): Promise<Response> {
  const active = provider();
  const response = await fetch(`${active.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${active.apiKey}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error("AI rate limit reached. Please retry in a moment.");
    }
    if (response.status === 402) {
      throw new Error("AI credits exhausted. Add credits to continue.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("AI key was rejected. Check your API key configuration.");
    }
    console.error(`[ai] ${path} failed [${response.status}]: ${body}`);
    throw new Error(`AI request failed (${response.status}).`);
  }

  return response;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
};

/** Plain text completion. */
export async function chatText(messages: ChatMessage[]): Promise<string> {
  const response = await aiFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider().chatModel, messages }),
  });
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/** JSON-mode completion. Returns `null` when the model output is unparseable. */
export async function chatJson<T>(messages: ChatMessage[]): Promise<T | null> {
  const response = await aiFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider().chatModel,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  return safeParseJson<T>(raw);
}

export function safeParseJson<T>(raw: string): T | null {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

/** Embeds a batch of texts. Batches stay under the provider's 100-input cap. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  const active = provider();
  // Gemini's direct API accepts a single input per embeddings request.
  const batchSize = active.kind === "gemini" ? 1 : 24;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const response = await aiFetch("/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: active.embeddingModel,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });
    const data = (await response.json()) as {
      data?: Array<{ index: number; embedding: number[] }>;
    };
    const ordered = [...(data.data ?? [])].sort((a, b) => a.index - b.index);
    for (const item of ordered) vectors.push(item.embedding);
  }

  return vectors;
}

export async function embedText(input: string): Promise<number[]> {
  const [vector] = await embedTexts([input]);
  if (!vector) throw new Error("Embedding failed.");
  return vector;
}

/** Reads text out of an image using the vision model (OCR replacement). */
export async function ocrImage(dataUrl: string): Promise<string> {
  return chatText([
    {
      role: "system",
      content:
        "You are an OCR engine. Transcribe every legible piece of text in the image, preserving reading order, tables and labels. Return plain text only.",
    },
    {
      role: "user",
      content: [
        { type: "text", text: "Transcribe this document image." },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ]);
}

function audioFormat(mimeType: string, filename: string): string {
  const fromMime = mimeType.split("/")[1]?.split(";")[0];
  const fromName = filename.split(".").pop();
  const raw = (fromMime || fromName || "mp3").toLowerCase();
  return raw === "mpeg" || raw === "mpga" ? "mp3" : raw === "x-wav" ? "wav" : raw;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/** Transcribes an audio file with whichever provider is configured. */
export async function transcribeAudio(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
): Promise<string> {
  // Gemini has no /audio/transcriptions endpoint — it takes audio inline.
  if (provider().kind === "gemini") {
    return chatText([
      {
        role: "system",
        content:
          "You are a transcription engine. Return the spoken content as plain text with speaker turns where identifiable. No commentary.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe this recording." },
          {
            type: "input_audio",
            input_audio: {
              data: toBase64(bytes),
              format: audioFormat(mimeType, filename),
            },
          },
        ],
      },
    ]);
  }

  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append(
    "file",
    new Blob([bytes as unknown as BlobPart], { type: mimeType }),
    filename,
  );

  const response = await aiFetch("/audio/transcriptions", {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}