import { chatJson } from "./ai.server";
import { ENTITY_TYPES, RELATIONSHIP_TYPES } from "./domain";

export type ExtractedEntity = {
  name: string;
  type: string;
  riskLevel: string;
  summary: string;
  page: number;
};

export type ExtractedRelationship = {
  source: string;
  target: string;
  type: string;
  confidence: number;
  evidence: string;
  page: number;
};

export type ExtractedFinding = {
  title: string;
  detail: string;
  severity: string;
  category: string;
  entity: string | null;
  page: number;
};

export type ExtractionResult = {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  findings: ExtractedFinding[];
};

const SYSTEM_PROMPT = `You are a compliance knowledge-graph extraction engine for an enterprise risk platform.
You read raw document text and return a strict JSON object describing the entities, relationships and compliance findings it contains.

Allowed entity types: ${ENTITY_TYPES.join(", ")}.
Allowed relationship types: ${RELATIONSHIP_TYPES.join(", ")}.
Allowed risk levels: low, medium, high, critical.
Allowed severities: low, medium, high, critical.

Rules:
- Only extract what is explicitly supported by the text. Never invent people, vendors, amounts or policies.
- Use the exact surface name found in the document; do not abbreviate or expand names.
- Every relationship's source and target MUST be the name of an entity you also return in "entities".
- Set "page" to the page number marked in the text (lines look like "[page N]"). Default to 1.
- Findings are compliance problems: violated policies, missing approvals, sanctioned counterparties, threshold breaches, expired documents, conflicts of interest.
- Return between 0 and 40 entities, 0 and 40 relationships, 0 and 12 findings.

Respond with JSON only, shaped exactly like:
{"entities":[{"name":"","type":"","riskLevel":"low","summary":"","page":1}],
 "relationships":[{"source":"","target":"","type":"","confidence":0.8,"evidence":"","page":1}],
 "findings":[{"title":"","detail":"","severity":"medium","category":"","entity":null,"page":1}]}`;

/** Runs entity/relationship/finding extraction over a document's text. */
export async function extractGraph(
  documentName: string,
  text: string,
): Promise<ExtractionResult> {
  const truncated = text.slice(0, 60_000);

  const result = await chatJson<Partial<ExtractionResult>>([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Document: ${documentName}\n\n----- BEGIN DOCUMENT -----\n${truncated}\n----- END DOCUMENT -----`,
    },
  ]);

  if (!result) return { entities: [], relationships: [], findings: [] };

  const entities = (result.entities ?? [])
    .filter((entity) => Boolean(entity?.name) && Boolean(entity?.type))
    .map((entity) => ({
      name: String(entity.name).trim().slice(0, 160),
      type: normalizeType(String(entity.type)),
      riskLevel: normalizeLevel(String(entity.riskLevel ?? "low")),
      summary: String(entity.summary ?? "").slice(0, 400),
      page: toPage(entity.page),
    }));

  const names = new Set(entities.map((entity) => entity.name.toLowerCase()));

  const relationships = (result.relationships ?? [])
    .filter(
      (rel) =>
        Boolean(rel?.source) &&
        Boolean(rel?.target) &&
        names.has(String(rel.source).trim().toLowerCase()) &&
        names.has(String(rel.target).trim().toLowerCase()) &&
        String(rel.source).trim().toLowerCase() !== String(rel.target).trim().toLowerCase(),
    )
    .map((rel) => ({
      source: String(rel.source).trim(),
      target: String(rel.target).trim(),
      type: String(rel.type ?? "MENTIONS").toUpperCase().replace(/[^A-Z_]/g, "_"),
      confidence: clamp(Number(rel.confidence ?? 0.7)),
      evidence: String(rel.evidence ?? "").slice(0, 400),
      page: toPage(rel.page),
    }));

  const findings = (result.findings ?? [])
    .filter((finding) => Boolean(finding?.title))
    .map((finding) => ({
      title: String(finding.title).slice(0, 200),
      detail: String(finding.detail ?? "").slice(0, 800),
      severity: normalizeLevel(String(finding.severity ?? "medium")),
      category: String(finding.category ?? "General").slice(0, 80),
      entity: finding.entity ? String(finding.entity).trim() : null,
      page: toPage(finding.page),
    }));

  return { entities, relationships, findings };
}

function normalizeType(value: string): string {
  const match = ENTITY_TYPES.find(
    (type) => type.toLowerCase() === value.trim().toLowerCase(),
  );
  return match ?? "Document";
}

function normalizeLevel(value: string): string {
  const level = value.trim().toLowerCase();
  return ["low", "medium", "high", "critical"].includes(level) ? level : "low";
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0.7;
  return Math.min(1, Math.max(0, value));
}

function toPage(value: unknown): number {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

/** Canonical key used to merge the same real-world entity across documents. */
export function canonicalKey(type: string, name: string): string {
  return `${type.toLowerCase()}::${name
    .toLowerCase()
    .replace(/\b(inc|ltd|llc|plc|corp|corporation|gmbh|pvt|limited)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()}`;
}

/** Splits page text into overlapping chunks suitable for embedding. */
export function chunkPages(
  pages: Array<{ page: number; text: string }>,
  size = 1200,
  overlap = 180,
): Array<{ page: number; idx: number; content: string }> {
  const chunks: Array<{ page: number; idx: number; content: string }> = [];
  let idx = 0;

  for (const page of pages) {
    const text = page.text.replace(/\s+\n/g, "\n").trim();
    if (!text) continue;

    if (text.length <= size) {
      chunks.push({ page: page.page, idx: idx++, content: text });
      continue;
    }

    let start = 0;
    while (start < text.length) {
      const slice = text.slice(start, start + size);
      if (slice.trim().length > 40) {
        chunks.push({ page: page.page, idx: idx++, content: slice.trim() });
      }
      start += size - overlap;
    }
  }

  return chunks.slice(0, 400);
}