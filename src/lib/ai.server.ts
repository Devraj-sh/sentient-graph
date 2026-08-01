/**
 * Thin server-only wrapper around the Lovable AI Gateway.
 * Handles chat completions, structured JSON output, embeddings,
 * image OCR and audio transcription. Never import from client code.
 */
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const CHAT_MODEL = "google/gemini-3.6-flash";
export const EMBEDDING_MODEL = "google/gemini-embedding-001";
export const TRANSCRIBE_MODEL = "openai/gpt-4o-mini-transcribe";

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  return key;
}

async function gatewayFetch(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
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
    console.error(`[ai] ${path} failed [${response.status}]: ${body}`);
    throw new Error(`AI request failed (${response.status}).`);
  }

  return response;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
};

/** Plain text completion. */
export async function chatText(messages: ChatMessage[]): Promise<string> {
  const response = await gatewayFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, messages }),
  });
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

/** JSON-mode completion. Returns `null` when the model output is unparseable. */
export async function chatJson<T>(messages: ChatMessage[]): Promise<T | null> {
  const response = await gatewayFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
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
  const batchSize = 24;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const response = await gatewayFetch("/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
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

/** Transcribes an audio file. */
export async function transcribeAudio(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("model", TRANSCRIBE_MODEL);
  form.append(
    "file",
    new Blob([bytes as unknown as BlobPart], { type: mimeType }),
    filename,
  );

  const response = await gatewayFetch("/audio/transcriptions", {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as { text?: string };
  return data.text ?? "";
}