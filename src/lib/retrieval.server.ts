import { chatJson, embedText } from "./ai.server";
import { CONFIDENCE_THRESHOLD, type Citation } from "./domain";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type GraphNode = { id: string; name: string; type: string; riskLevel: string };

export type Evidence = {
  citations: Citation[];
  nodes: GraphNode[];
  edges: Array<{ source: string; target: string; type: string; evidence: string | null }>;
  topSimilarity: number;
};

/**
 * GraphRAG retrieval: semantic chunk search + knowledge-graph expansion,
 * merged and ranked into a single evidence bundle.
 */
export async function retrieveEvidence(
  db: AdminClient,
  question: string,
): Promise<Evidence> {
  const queryEmbedding = await embedText(question);

  const { data: matches, error } = await db.rpc("match_chunks", {
    query_embedding: queryEmbedding as unknown as string,
    match_count: 10,
  });
  if (error) {
    console.error("[retrieval] match_chunks failed", error);
    throw new Error("Vector search failed.");
  }

  const rows = (matches ?? []) as Array<{
    id: string;
    document_id: string;
    document_name: string;
    page: number;
    content: string;
    similarity: number;
  }>;

  const documentIds = [...new Set(rows.map((row) => row.document_id))];
  const { data: documents } = await db
    .from("documents")
    .select("id, storage_path")
    .in("id", documentIds.length ? documentIds : ["00000000-0000-0000-0000-000000000000"]);

  const pathById = new Map(
    (documents ?? []).map((doc) => [doc.id, doc.storage_path as string | null]),
  );

  const citations: Citation[] = rows.map((row) => ({
    documentId: row.document_id,
    documentName: row.document_name,
    page: row.page,
    excerpt: row.content,
    similarity: Number(row.similarity ?? 0),
    storagePath: pathById.get(row.document_id) ?? null,
  }));

  const topSimilarity = citations[0]?.similarity ?? 0;

  // Graph side of the retrieval: match entities named in the question or in
  // the retrieved passages, then expand one hop through the relationship graph.
  const { data: allEntities } = await db
    .from("entities")
    .select("id, name, type, risk_level")
    .limit(2000);

  const entities = (allEntities ?? []) as Array<{
    id: string;
    name: string;
    type: string;
    risk_level: string;
  }>;

  const haystack = `${question}\n${citations
    .slice(0, 6)
    .map((citation) => citation.excerpt)
    .join("\n")}`.toLowerCase();

  const seed = entities.filter(
    (entity) => entity.name.length > 2 && haystack.includes(entity.name.toLowerCase()),
  );

  const seedIds = seed.map((entity) => entity.id);
  const { data: edgeRows } = seedIds.length
    ? await db
        .from("relationships")
        .select("source_id, target_id, type, evidence")
        .or(
          `source_id.in.(${seedIds.join(",")}),target_id.in.(${seedIds.join(",")})`,
        )
        .limit(200)
    : { data: [] };

  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const involved = new Map<string, GraphNode>();
  for (const entity of seed) {
    involved.set(entity.id, {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      riskLevel: entity.risk_level,
    });
  }

  const edges: Evidence["edges"] = [];
  for (const edge of (edgeRows ?? []) as Array<{
    source_id: string;
    target_id: string;
    type: string;
    evidence: string | null;
  }>) {
    const source = byId.get(edge.source_id);
    const target = byId.get(edge.target_id);
    if (!source || !target) continue;
    for (const node of [source, target]) {
      involved.set(node.id, {
        id: node.id,
        name: node.name,
        type: node.type,
        riskLevel: node.risk_level,
      });
    }
    edges.push({
      source: source.name,
      target: target.name,
      type: edge.type,
      evidence: edge.evidence,
    });
  }

  return {
    citations,
    nodes: [...involved.values()].slice(0, 60),
    edges: edges.slice(0, 120),
    topSimilarity,
  };
}

export type GeneratedAnswer = {
  answer: string;
  reasoning: string;
  confidence: number;
  refused: boolean;
  usedCitations: number[];
};

const ANSWER_SYSTEM = `You are Lumen, an enterprise compliance analyst.
You answer ONLY from the numbered evidence passages and graph facts supplied to you.

Hard rules:
- Never state a fact that is not directly supported by the evidence.
- If the evidence does not answer the question, set "refused" to true and leave "answer" empty.
- Cite evidence by its number in "usedCitations".
- "confidence" is your honest 0-1 assessment of how well the evidence supports the answer.
- Be concise and executive in tone. Use short markdown paragraphs or bullets.

Respond with JSON only: {"answer":"","reasoning":"","confidence":0.0,"refused":false,"usedCitations":[1]}`;

/** Ranks the evidence, applies the hallucination guard, and asks the model. */
export async function generateAnswer(
  question: string,
  evidence: Evidence,
): Promise<GeneratedAnswer> {
  const strong = evidence.citations.filter((citation) => citation.similarity > 0.2).slice(0, 8);

  if (!strong.length || evidence.topSimilarity < CONFIDENCE_THRESHOLD) {
    return {
      answer: "",
      reasoning:
        "Retrieval confidence fell below the evidence threshold, so no answer was generated.",
      confidence: Number(evidence.topSimilarity.toFixed(3)),
      refused: true,
      usedCitations: [],
    };
  }

  const passages = strong
    .map(
      (citation, index) =>
        `[${index + 1}] ${citation.documentName} (page ${citation.page}, similarity ${citation.similarity.toFixed(
          2,
        )}):\n${citation.excerpt}`,
    )
    .join("\n\n");

  const graphFacts = evidence.edges
    .slice(0, 40)
    .map((edge) => `- ${edge.source} —[${edge.type}]→ ${edge.target}`)
    .join("\n");

  const result = await chatJson<GeneratedAnswer>([
    { role: "system", content: ANSWER_SYSTEM },
    {
      role: "user",
      content: `Question: ${question}\n\nEVIDENCE PASSAGES:\n${passages}\n\nKNOWLEDGE GRAPH FACTS:\n${
        graphFacts || "(none)"
      }`,
    },
  ]);

  if (!result || result.refused || !result.answer?.trim()) {
    return {
      answer: "",
      reasoning: result?.reasoning ?? "The model found the evidence insufficient.",
      confidence: Math.min(Number(result?.confidence ?? 0), evidence.topSimilarity),
      refused: true,
      usedCitations: [],
    };
  }

  const modelConfidence = Number.isFinite(result.confidence) ? result.confidence : 0.6;
  // Blend model self-assessment with measured retrieval strength.
  const confidence = Number(
    Math.min(0.99, modelConfidence * 0.6 + evidence.topSimilarity * 0.4).toFixed(3),
  );

  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      answer: "",
      reasoning: "Blended evidence confidence stayed below the safe answering threshold.",
      confidence,
      refused: true,
      usedCitations: [],
    };
  }

  return {
    answer: result.answer.trim(),
    reasoning: String(result.reasoning ?? "").slice(0, 1200),
    confidence,
    refused: false,
    usedCitations: Array.isArray(result.usedCitations)
      ? result.usedCitations.filter((n) => Number.isFinite(n))
      : [],
  };
}