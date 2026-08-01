import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { AnswerResult, Citation } from "./domain";

const PageSchema = z.object({ page: z.number().int().min(1), text: z.string() });

const IngestSchema = z.object({
  documentId: z.string().uuid(),
  pages: z.array(PageSchema).min(1).max(400),
});

const MediaSchema = z.object({
  kind: z.enum(["image", "audio"]),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  base64: z.string().min(16).max(28_000_000),
});

/**
 * OCR an image or transcribe an audio file into plain document text.
 * Runs server-side so the AI key never reaches the browser.
 */
export const extractMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MediaSchema.parse(input))
  .handler(async ({ data }) => {
    const { ocrImage, transcribeAudio } = await import("./ai.server");

    if (data.kind === "image") {
      const text = await ocrImage(`data:${data.mimeType};base64,${data.base64}`);
      return { text };
    }

    const binary = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));
    const text = await transcribeAudio(binary, data.mimeType, data.filename);
    return { text };
  });

/**
 * Full ingestion pipeline for one document:
 * chunk -> embed -> store vectors -> extract entities/relationships/findings -> build graph.
 */
export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IngestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { embedTexts } = await import("./ai.server");
    const { canonicalKey, chunkPages, extractGraph } = await import("./extract.server");

    const { data: document, error: documentError } = await db
      .from("documents")
      .select("id, name")
      .eq("id", data.documentId)
      .maybeSingle();

    if (documentError || !document) throw new Error("Document not found.");

    const fail = async (message: string) => {
      await db
        .from("documents")
        .update({ status: "failed", stage: "error", error: message })
        .eq("id", data.documentId);
    };

    try {
      const pages = data.pages.filter((page) => page.text.trim().length > 0);
      if (!pages.length) throw new Error("No readable text was found in this file.");

      // 1. Chunk + embed
      await db
        .from("documents")
        .update({ status: "processing", stage: "chunking", pages: pages.length })
        .eq("id", data.documentId);

      const chunks = chunkPages(pages);
      if (!chunks.length) throw new Error("Document produced no usable text chunks.");

      await db
        .from("documents")
        .update({ stage: "embedding" })
        .eq("id", data.documentId);

      const vectors = await embedTexts(chunks.map((chunk) => chunk.content));

      await db.from("chunks").delete().eq("document_id", data.documentId);
      const { error: chunkError } = await db.from("chunks").insert(
        chunks.map((chunk, index) => ({
          owner_id: context.userId,
          document_id: data.documentId,
          page: chunk.page,
          idx: chunk.idx,
          content: chunk.content,
          embedding: vectors[index] as unknown as string,
        })),
      );
      if (chunkError) throw new Error(`Storing embeddings failed: ${chunkError.message}`);

      // 2. Entity + relationship extraction
      await db
        .from("documents")
        .update({ stage: "extracting" })
        .eq("id", data.documentId);

      const corpus = pages
        .map((page) => `[page ${page.page}]\n${page.text}`)
        .join("\n\n");
      const extraction = await extractGraph(document.name, corpus);

      // 3. Merge entities into the graph by canonical key
      await db
        .from("documents")
        .update({ stage: "graphing" })
        .eq("id", data.documentId);

      const idByName = new Map<string, string>();

      for (const entity of extraction.entities) {
        const key = canonicalKey(entity.type, entity.name);
        const { data: existing } = await db
          .from("entities")
          .select("id, mentions, risk_level")
          .eq("canonical_key", key)
          .maybeSingle();

        if (existing) {
          await db
            .from("entities")
            .update({
              mentions: (existing.mentions ?? 1) + 1,
              risk_level: strongerRisk(existing.risk_level, entity.riskLevel),
            })
            .eq("id", existing.id);
          idByName.set(entity.name.toLowerCase(), existing.id);
          continue;
        }

        const { data: inserted, error: insertError } = await db
          .from("entities")
          .insert({
            owner_id: context.userId,
            name: entity.name,
            type: entity.type,
            canonical_key: key,
            risk_level: entity.riskLevel,
            summary: entity.summary,
            document_id: data.documentId,
            page: entity.page,
          })
          .select("id")
          .maybeSingle();

        if (insertError) {
          console.error("[ingest] entity insert failed", insertError);
          continue;
        }
        if (inserted) idByName.set(entity.name.toLowerCase(), inserted.id);
      }

      for (const relationship of extraction.relationships) {
        const sourceId = idByName.get(relationship.source.toLowerCase());
        const targetId = idByName.get(relationship.target.toLowerCase());
        if (!sourceId || !targetId) continue;

        const { error: relError } = await db.from("relationships").upsert(
          {
            owner_id: context.userId,
            source_id: sourceId,
            target_id: targetId,
            type: relationship.type,
            confidence: relationship.confidence,
            evidence: relationship.evidence,
            document_id: data.documentId,
            page: relationship.page,
          },
          { onConflict: "source_id,target_id,type" },
        );
        if (relError) console.error("[ingest] relationship upsert failed", relError);
      }

      if (extraction.findings.length) {
        const { error: findingError } = await db.from("findings").insert(
          extraction.findings.map((finding) => ({
            owner_id: context.userId,
            title: finding.title,
            detail: finding.detail,
            severity: finding.severity,
            category: finding.category,
            entity_id: finding.entity
              ? (idByName.get(finding.entity.toLowerCase()) ?? null)
              : null,
            document_id: data.documentId,
            page: finding.page,
          })),
        );
        if (findingError) console.error("[ingest] findings insert failed", findingError);
      }

      await db
        .from("documents")
        .update({ status: "ready", stage: "done", error: null, pages: pages.length })
        .eq("id", data.documentId);

      return {
        chunks: chunks.length,
        entities: extraction.entities.length,
        relationships: extraction.relationships.length,
        findings: extraction.findings.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Processing failed.";
      await fail(message);
      throw new Error(message);
    }
  });

function strongerRisk(a: string | null, b: string): string {
  const order = ["low", "medium", "high", "critical"];
  return order.indexOf(b) > order.indexOf(a ?? "low") ? b : (a ?? "low");
}

const AskSchema = z.object({ question: z.string().trim().min(3).max(600) });

/** GraphRAG question answering with citations, confidence and a hallucination guard. */
export const askCompliance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data, context }): Promise<AnswerResult> => {
    const db = context.supabase;
    const { generateAnswer, retrieveEvidence } = await import("./retrieval.server");

    const evidence = await retrieveEvidence(db, data.question);
    const generated = await generateAnswer(data.question, evidence);

    const used = new Set(generated.usedCitations);
    const selected: Citation[] = generated.refused
      ? []
      : evidence.citations
          .slice(0, 8)
          .filter((_, index) => used.size === 0 || used.has(index + 1))
          .slice(0, 5);

    const graphNodes = generated.refused
      ? []
      : evidence.nodes.slice(0, 24).map((node) => ({
          id: node.id,
          name: node.name,
          type: node.type,
        }));

    const { data: saved, error } = await db
      .from("questions")
      .insert({
        owner_id: context.userId,
        question: data.question,
        answer: generated.refused ? null : generated.answer,
        confidence: generated.confidence,
        refused: generated.refused,
        reasoning: generated.reasoning,
        citations: selected as unknown as never,
        graph_nodes: graphNodes as unknown as never,
      })
      .select("id")
      .maybeSingle();

    if (error) console.error("[ask] failed to persist question", error);

    return {
      id: saved?.id ?? crypto.randomUUID(),
      answer: generated.answer,
      reasoning: generated.reasoning,
      confidence: generated.confidence,
      refused: generated.refused,
      citations: selected,
      graphNodes,
    };
  });

/** Creates a time-limited download link for a cited source document. */
export const getSourceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storagePath: z.string().min(1).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: signed, error } = await db.storage
      .from("documents")
      .createSignedUrl(data.storagePath, 300);
    if (error || !signed) throw new Error("Could not create a download link.");
    return { url: signed.signedUrl };
  });

/** Executive AI insights derived from the current knowledge graph. */
export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
  const db = context.supabase;
  const { chatJson } = await import("./ai.server");

  const [{ data: entities }, { data: findings }, { data: relationships }] = await Promise.all([
    db.from("entities").select("name, type, risk_level, summary").limit(300),
    db.from("findings").select("title, detail, severity, category").limit(150),
    db.from("relationships").select("type").limit(500),
  ]);

  if (!entities?.length) {
    return {
      executiveSummary: "No documents have been ingested yet, so there is nothing to analyse.",
      riskSummary: "",
      gaps: [] as string[],
      recommendations: [] as string[],
      topViolations: [] as string[],
    };
  }

  const result = await chatJson<{
    executiveSummary: string;
    riskSummary: string;
    gaps: string[];
    recommendations: string[];
    topViolations: string[];
  }>([
    {
      role: "system",
      content:
        'You are a chief compliance officer summarising a knowledge graph built from company documents. Ground every statement in the supplied data. Respond with JSON only: {"executiveSummary":"","riskSummary":"","gaps":[""],"recommendations":[""],"topViolations":[""]}',
    },
    {
      role: "user",
      content: `ENTITIES:\n${JSON.stringify(entities).slice(0, 24_000)}\n\nFINDINGS:\n${JSON.stringify(
        findings ?? [],
      ).slice(0, 16_000)}\n\nRELATIONSHIP TYPES:\n${JSON.stringify(
        (relationships ?? []).map((relationship) => relationship.type),
      ).slice(0, 4_000)}`,
    },
  ]);

  return {
    executiveSummary: result?.executiveSummary ?? "Insight generation returned no summary.",
    riskSummary: result?.riskSummary ?? "",
    gaps: result?.gaps ?? [],
    recommendations: result?.recommendations ?? [],
    topViolations: result?.topViolations ?? [],
  };
  });
