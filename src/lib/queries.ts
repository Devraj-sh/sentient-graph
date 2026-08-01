import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type DocumentRow = {
  id: string;
  name: string;
  kind: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: string;
  stage: string | null;
  error: string | null;
  pages: number | null;
  storage_path: string | null;
  created_at: string;
};

export type EntityRow = {
  id: string;
  name: string;
  type: string;
  risk_level: string;
  summary: string | null;
  mentions: number;
  document_id: string | null;
  page: number | null;
};

export type RelationshipRow = {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  confidence: number | null;
  evidence: string | null;
};

export type FindingRow = {
  id: string;
  title: string;
  detail: string | null;
  severity: string;
  category: string | null;
  entity_id: string | null;
  document_id: string | null;
  page: number | null;
  created_at: string;
};

export type QuestionRow = {
  id: string;
  question: string;
  answer: string | null;
  confidence: number | null;
  refused: boolean;
  reasoning: string | null;
  citations: unknown;
  graph_nodes: unknown;
  created_at: string;
};

export const documentsQuery = queryOptions({
  queryKey: ["documents"],
  queryFn: async (): Promise<DocumentRow[]> => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DocumentRow[];
  },
});

export const entitiesQuery = queryOptions({
  queryKey: ["entities"],
  queryFn: async (): Promise<EntityRow[]> => {
    const { data, error } = await supabase
      .from("entities")
      .select("id, name, type, risk_level, summary, mentions, document_id, page")
      .order("mentions", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as EntityRow[];
  },
});

export const relationshipsQuery = queryOptions({
  queryKey: ["relationships"],
  queryFn: async (): Promise<RelationshipRow[]> => {
    const { data, error } = await supabase
      .from("relationships")
      .select("id, source_id, target_id, type, confidence, evidence")
      .limit(1500);
    if (error) throw error;
    return (data ?? []) as RelationshipRow[];
  },
});

export const findingsQuery = queryOptions({
  queryKey: ["findings"],
  queryFn: async (): Promise<FindingRow[]> => {
    const { data, error } = await supabase
      .from("findings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw error;
    return (data ?? []) as FindingRow[];
  },
});

export const questionsQuery = queryOptions({
  queryKey: ["questions"],
  queryFn: async (): Promise<QuestionRow[]> => {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as QuestionRow[];
  },
});