import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Quote, Send, ShieldCheck, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askCompliance, getSourceLink } from "@/lib/compliance.functions";
import type { AnswerResult } from "@/lib/domain";
import { documentsQuery } from "@/lib/queries";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "GraphRAG Chat — Lumen" },
      {
        name: "description",
        content:
          "Ask compliance questions and get answers grounded in cited passages and knowledge-graph facts.",
      },
      { property: "og:title", content: "GraphRAG Chat — Lumen" },
      {
        property: "og:description",
        content: "Cited, hallucination-guarded answers over your own compliance corpus.",
      },
    ],
  }),
  component: ChatPage,
});

type Turn = { id: string; question: string; result?: AnswerResult; error?: string };

const SUGGESTIONS = [
  "Which vendors are linked to unapproved payments?",
  "Summarise our data retention obligations.",
  "Who approved the highest-value contract?",
  "What compliance gaps exist across these documents?",
];

function ChatPage() {
  const queryClient = useQueryClient();
  const documents = useQuery(documentsQuery);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ask = useServerFn(askCompliance);
  const openSource = useServerFn(getSourceLink);

  const mutation = useMutation({
    mutationFn: async (question: string) => ask({ data: { question } }),
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, mutation.isPending]);

  const submit = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || mutation.isPending) return;

    const id = crypto.randomUUID();
    setTurns((current) => [...current, { id, question: trimmed }]);
    setInput("");

    try {
      const result = await mutation.mutateAsync(trimmed);
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, result } : turn)),
      );
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setTurns((current) =>
        current.map((turn) => (turn.id === id ? { ...turn, error: message } : turn)),
      );
    } finally {
      textareaRef.current?.focus();
    }
  };

  const ready = (documents.data ?? []).filter((doc) => doc.status === "ready").length;

  return (
    <AppShell
      title="GraphRAG Chat"
      subtitle={`Grounded in ${ready} processed document${ready === 1 ? "" : "s"} · hallucination guard active`}
    >
      <div className="mx-auto flex max-w-3xl flex-col">
        <div className="min-h-[52vh] space-y-6">
          {!turns.length ? (
            <div className="glass-card p-6">
              <h2 className="text-sm font-semibold">Ask about your corpus</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every answer must be supported by retrieved passages. If the evidence is weak,
                Lumen refuses rather than guessing.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void submit(suggestion)}
                    className="rounded-lg border border-border/60 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {turn.question}
                </p>
              </div>

              {turn.error ? (
                <p className="text-sm text-danger">{turn.error}</p>
              ) : turn.result ? (
                <AnswerBlock
                  result={turn.result}
                  onOpenSource={async (storagePath) => {
                    const { url } = await openSource({ data: { storagePath } });
                    window.open(url, "_blank", "noopener");
                  }}
                />
              ) : (
                <p className="animate-pulse text-sm text-muted-foreground">
                  Retrieving evidence and traversing the graph…
                </p>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          className="sticky bottom-4 mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(input);
          }}
        >
          <div className="glass-card flex items-end gap-2 p-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit(input);
                }
              }}
              rows={2}
              placeholder="Ask a compliance question…"
              className="min-h-[52px] resize-none border-0 bg-transparent focus-visible:ring-0"
            />
            <Button type="submit" size="icon" disabled={mutation.isPending || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function AnswerBlock({
  result,
  onOpenSource,
}: {
  result: AnswerResult;
  onOpenSource: (storagePath: string) => Promise<void>;
}) {
  const confidence = Math.round(result.confidence * 100);

  if (result.refused) {
    return (
      <div className="glass-card border-warning/40 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-warning">
          <ShieldAlert className="size-4" />
          Answer withheld by the hallucination guard
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{result.reasoning}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Retrieval confidence {confidence}%. Upload more relevant documents or rephrase the
          question.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-success">
          <ShieldCheck className="size-4" />
          Grounded answer
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          confidence
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full bg-success"
              style={{ width: `${confidence}%` }}
            />
          </span>
          <span className="tabular-nums">{confidence}%</span>
        </span>
      </div>

      <div className="prose prose-invert prose-sm mt-3 max-w-none">
        <ReactMarkdown>{result.answer}</ReactMarkdown>
      </div>

      {result.graphNodes.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {result.graphNodes.map((node) => (
            <span
              key={node.id}
              className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {node.name}
            </span>
          ))}
        </div>
      ) : null}

      {result.citations.length ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Quote className="size-3.5" />
            Sources
          </p>
          <ul className="mt-2 space-y-2">
            {result.citations.map((citation, index) => (
              <li key={`${citation.documentId}-${index}`} className="rounded-lg bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <FileText className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">
                      [{index + 1}] {citation.documentName} · p.{citation.page}
                    </span>
                  </span>
                  {citation.storagePath ? (
                    <button
                      type="button"
                      className="shrink-0 text-primary hover:underline"
                      onClick={() => void onOpenSource(citation.storagePath!)}
                    >
                      Open
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                  {citation.excerpt}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.reasoning ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Why this answer
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">{result.reasoning}</p>
        </details>
      ) : null}
    </div>
  );
}