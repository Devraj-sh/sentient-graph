import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { extractMedia, ingestDocument } from "@/lib/compliance.functions";
import { formatBytes, sanitizeFilename } from "@/lib/domain";
import {
  detectKind,
  fileToBase64,
  parsePdf,
  parseSheet,
  parseText,
  type ParsedPage,
} from "@/lib/parse-client";
import { documentsQuery } from "@/lib/queries";

export const Route = createFileRoute("/ingest")({
  head: () => ({
    meta: [
      { title: "Document Ingestion — ComplyGraph" },
      {
        name: "description",
        content:
          "Upload contracts, policies, spreadsheets, scans and recordings; ComplyGraph parses, embeds and graphs them automatically.",
      },
      { property: "og:title", content: "Document Ingestion — ComplyGraph" },
      {
        property: "og:description",
        content: "Parse, embed and graph enterprise compliance documents in one pass.",
      },
    ],
  }),
  component: IngestPage,
});

type Progress = { name: string; stage: string; error?: string | undefined };

const STAGES = ["uploading", "parsing", "chunking", "embedding", "extracting", "graphing"];

function IngestPage() {
  const queryClient = useQueryClient();
  const documents = useQuery(documentsQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<Progress[]>([]);
  const [dragging, setDragging] = useState(false);

  const runIngest = useServerFn(ingestDocument);
  const runMedia = useServerFn(extractMedia);

  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const kind = detectKind(file);
        const update = (stage: string, error?: string) =>
          setActive((current) => {
            const rest = current.filter((item) => item.name !== file.name);
            return [...rest, { name: file.name, stage, error }];
          });

        update("uploading");

        const storagePath = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(storagePath, file, { upsert: false });

        if (uploadError) {
          update("failed", uploadError.message);
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("documents")
          .insert({
            name: file.name,
            kind,
            mime_type: file.type || null,
            size_bytes: file.size,
            storage_path: storagePath,
            status: "processing",
            stage: "parsing",
          })
          .select("id")
          .maybeSingle();

        if (insertError || !inserted) {
          update("failed", insertError?.message ?? "Could not create the document record.");
          continue;
        }

        queryClient.invalidateQueries({ queryKey: ["documents"] });
        update("parsing");

        try {
          let pages: ParsedPage[] = [];

          if (kind === "pdf") pages = await parsePdf(file);
          else if (kind === "sheet") pages = await parseSheet(file);
          else if (kind === "text") pages = await parseText(file);
          else if (kind === "image" || kind === "audio") {
            const base64 = await fileToBase64(file);
            const { text } = await runMedia({
              data: {
                kind,
                filename: file.name,
                mimeType: file.type || (kind === "image" ? "image/png" : "audio/mpeg"),
                base64,
              },
            });
            pages = [{ page: 1, text }];
          } else {
            pages = await parseText(file);
          }

          pages = pages.filter((page) => page.text.trim().length > 0);
          if (!pages.length) throw new Error("No readable text found in this file.");

          update("embedding");
          await runIngest({ data: { documentId: inserted.id, pages } });
          update("done");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Processing failed.";
          update("failed", message);
          await supabase
            .from("documents")
            .update({ status: "failed", stage: "error", error: message })
            .eq("id", inserted.id);
        }

        queryClient.invalidateQueries();
      }
    },
    [queryClient, runIngest, runMedia],
  );

  return (
    <AppShell
      title="Document Ingestion"
      subtitle="PDFs, spreadsheets, text, scanned images and audio are parsed, embedded and graphed."
      actions={
        <Button size="sm" onClick={() => inputRef.current?.click()}>
          <UploadCloud className="size-4" />
          Select files
        </Button>
      }
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.csv,.tsv,.xlsx,.xls,.txt,.md,.json,image/*,audio/*"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void handleFiles(files);
        }}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const files = Array.from(event.dataTransfer.files ?? []);
          if (files.length) void handleFiles(files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`glass-card flex cursor-pointer flex-col items-center justify-center px-6 py-14 text-center transition-colors ${
          dragging ? "border-primary/60 bg-primary/5" : ""
        }`}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/12 ring-1 ring-primary/25">
          <UploadCloud className="size-6 text-primary" />
        </span>
        <p className="mt-4 text-sm font-medium">Drop files here or click to browse</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          Contracts, policy manuals, vendor lists, invoices, scanned pages and meeting
          recordings. Each file is chunked, embedded and turned into graph entities and
          relationships.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] text-muted-foreground">
          {[
            { icon: FileText, label: "PDF / TXT" },
            { icon: FileSpreadsheet, label: "CSV / XLSX" },
            { icon: FileImage, label: "Scans (OCR)" },
            { icon: FileAudio, label: "Audio (transcribed)" },
          ].map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1"
            >
              <item.icon className="size-3.5" />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {active.length ? (
        <section className="glass-card mt-4 p-5">
          <h2 className="text-sm font-semibold">Pipeline</h2>
          <ul className="mt-3 space-y-3">
            {active.map((item) => (
              <li key={item.name}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.name}</span>
                  <span
                    className={
                      item.stage === "failed"
                        ? "text-danger"
                        : item.stage === "done"
                          ? "text-success"
                          : "text-muted-foreground"
                    }
                  >
                    {item.stage === "failed"
                      ? (item.error ?? "failed")
                      : item.stage === "done"
                        ? "complete"
                        : item.stage}
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  {STAGES.map((stage, index) => {
                    const current = STAGES.indexOf(item.stage);
                    const done = item.stage === "done" || (current >= 0 && index <= current);
                    return (
                      <span
                        key={stage}
                        className={`h-1 flex-1 rounded-full ${
                          item.stage === "failed"
                            ? "bg-danger/40"
                            : done
                              ? "bg-primary"
                              : "bg-secondary"
                        }`}
                      />
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="glass-card mt-4 overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 className="text-sm font-semibold">Corpus</h2>
          <p className="text-xs text-muted-foreground">
            {documents.data?.length ?? 0} documents ingested
          </p>
        </div>
        <ul className="divide-y divide-border/60">
          {(documents.data ?? []).map((document) => (
            <li key={document.id} className="flex items-center gap-3 px-5 py-3">
              {document.status === "ready" ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : document.status === "failed" ? (
                <XCircle className="size-4 shrink-0 text-danger" />
              ) : (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{document.name}</p>
                <p className="text-xs text-muted-foreground">
                  {document.kind} · {formatBytes(document.size_bytes ?? 0)}
                  {document.pages ? ` · ${document.pages} pages` : ""}
                  {document.error ? ` · ${document.error}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{document.stage}</span>
            </li>
          ))}
          {!documents.data?.length ? (
            <li className="px-5 py-6 text-sm text-muted-foreground">Nothing ingested yet.</li>
          ) : null}
        </ul>
      </section>
    </AppShell>
  );
}