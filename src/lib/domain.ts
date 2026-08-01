/** Shared, client-safe domain vocabulary for the compliance knowledge graph. */

export const ENTITY_TYPES = [
  "Person",
  "Organization",
  "Department",
  "Policy",
  "Law",
  "Rule",
  "Document",
  "Amount",
  "Date",
  "Country",
  "Vendor",
  "Asset",
  "Risk",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  "APPROVED",
  "BELONGS_TO",
  "REGULATED_BY",
  "VIOLATES",
  "OWNS",
  "REPORTS_TO",
  "WORKS_FOR",
  "ISSUED_BY",
  "PAID_TO",
  "LOCATED_IN",
  "MENTIONS",
  "REQUIRES",
  "MITIGATES",
  "EXPOSED_TO",
] as const;

/** Palette keys resolve to CSS variables declared in styles.css. */
export const ENTITY_COLORS: Record<string, string> = {
  Person: "oklch(0.76 0.13 187)",
  Organization: "oklch(0.7 0.14 250)",
  Vendor: "oklch(0.72 0.16 300)",
  Department: "oklch(0.78 0.12 210)",
  Policy: "oklch(0.8 0.15 78)",
  Law: "oklch(0.82 0.13 100)",
  Rule: "oklch(0.79 0.11 120)",
  Document: "oklch(0.72 0.04 250)",
  Amount: "oklch(0.74 0.15 155)",
  Date: "oklch(0.68 0.06 240)",
  Country: "oklch(0.7 0.1 200)",
  Asset: "oklch(0.73 0.1 330)",
  Risk: "oklch(0.66 0.2 22)",
};

export function entityColor(type: string): string {
  return ENTITY_COLORS[type] ?? "oklch(0.7 0.03 250)";
}

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_WEIGHT: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 12,
};

export const SEVERITY_COLOR: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-warning",
  high: "text-danger",
  critical: "text-danger",
};

export type Citation = {
  documentId: string;
  documentName: string;
  page: number;
  excerpt: string;
  similarity: number;
  storagePath: string | null;
};

export type AnswerResult = {
  id: string;
  answer: string;
  reasoning: string;
  confidence: number;
  refused: boolean;
  citations: Citation[];
  graphNodes: Array<{ id: string; name: string; type: string }>;
};

/** Minimum retrieval confidence required before the model is allowed to answer. */
export const CONFIDENCE_THRESHOLD = 0.42;

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(-120);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}