import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  Network,
  ShieldAlert,
  Sparkle,
  TrendingUp,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { generateInsights } from "@/lib/compliance.functions";
import { RISK_WEIGHT, entityColor } from "@/lib/domain";
import {
  documentsQuery,
  entitiesQuery,
  findingsQuery,
  questionsQuery,
  relationshipsQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lumen — GraphRAG Compliance Intelligence" },
      {
        name: "description",
        content:
          "Turn contracts, policies and reports into an auditable knowledge graph with cited, hallucination-guarded answers.",
      },
      { property: "og:title", content: "Lumen — GraphRAG Compliance Intelligence" },
      {
        property: "og:description",
        content:
          "Enterprise compliance intelligence: document ingestion, knowledge graph, and cited GraphRAG answers.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const documents = useQuery(documentsQuery);
  const entities = useQuery(entitiesQuery);
  const relationships = useQuery(relationshipsQuery);
  const findings = useQuery(findingsQuery);
  const questions = useQuery(questionsQuery);

  const insightsFn = useServerFn(generateInsights);
  const insights = useMutation({ mutationFn: () => insightsFn({ data: undefined }) });

  const findingRows = findings.data ?? [];
  const entityRows = entities.data ?? [];
  const readyDocs = (documents.data ?? []).filter((doc) => doc.status === "ready");

  const riskScore = Math.min(
    100,
    findingRows.reduce((total, finding) => total + (RISK_WEIGHT[finding.severity] ?? 1), 0),
  );

  const typeCounts = entityRows.reduce<Record<string, number>>((acc, entity) => {
    acc[entity.type] = (acc[entity.type] ?? 0) + 1;
    return acc;
  }, {});
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxType = topTypes[0]?.[1] ?? 1;

  return (
    <AppShell
      title="Compliance Command Center"
      subtitle="Live view of your document corpus, knowledge graph and open risk."
      actions={
        <div className="flex gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link to="/ingest">Ingest documents</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/chat">Ask a question</Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Documents"
          value={readyDocs.length}
          hint={`${documents.data?.length ?? 0} uploaded`}
          icon={FileText}
        />
        <StatCard
          label="Entities"
          value={entityRows.length}
          hint={`${Object.keys(typeCounts).length} distinct types`}
          icon={Users}
          tone="success"
        />
        <StatCard
          label="Relationships"
          value={relationships.data?.length ?? 0}
          hint="Graph edges extracted"
          icon={Network}
        />
        <StatCard
          label="Risk score"
          value={riskScore}
          hint={`${findingRows.length} open findings`}
          icon={ShieldAlert}
          tone={riskScore > 60 ? "danger" : riskScore > 25 ? "warning" : "success"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">AI executive briefing</h2>
              <p className="text-xs text-muted-foreground">
                Generated from the current knowledge graph, not from model memory.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => insights.mutate()}
              disabled={insights.isPending || entityRows.length === 0}
            >
              <Sparkle className="size-4" />
              {insights.isPending ? "Analysing…" : "Generate"}
            </Button>
          </div>

          <div className="mt-4 text-sm">
            {insights.isError ? (
              <p className="text-danger">
                {(insights.error as Error).message}
              </p>
            ) : insights.data ? (
              <div className="space-y-4">
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{insights.data.executiveSummary}</ReactMarkdown>
                </div>
                {insights.data.topViolations.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Top violations
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {insights.data.topViolations.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-danger">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {insights.data.recommendations.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recommended actions
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {insights.data.recommendations.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-primary">→</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">
                {entityRows.length
                  ? "Run an analysis to summarise risk exposure across every ingested document."
                  : "Ingest a document to unlock executive insights."}
              </p>
            )}
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold">Entity mix</h2>
          <p className="text-xs text-muted-foreground">Distribution across the graph.</p>
          <div className="mt-4 space-y-3">
            {topTypes.length ? (
              topTypes.map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{type}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / maxType) * 100}%`,
                        backgroundColor: entityColor(type),
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No entities yet.</p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold">Latest findings</h2>
          <ul className="mt-3 space-y-3">
            {findingRows.slice(0, 6).map((finding) => (
              <li key={finding.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{finding.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ring-1 ${
                      finding.severity === "critical" || finding.severity === "high"
                        ? "bg-danger/10 text-danger ring-danger/30"
                        : finding.severity === "medium"
                          ? "bg-warning/10 text-warning ring-warning/30"
                          : "bg-secondary text-muted-foreground ring-border"
                    }`}
                  >
                    {finding.severity}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {finding.detail}
                </p>
              </li>
            ))}
            {!findingRows.length ? (
              <li className="text-sm text-muted-foreground">No findings detected yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="glass-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-primary" />
            Recent questions
          </h2>
          <ul className="mt-3 space-y-2">
            {(questions.data ?? []).slice(0, 7).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <span className="truncate text-sm">{item.question}</span>
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    item.refused ? "text-warning" : "text-success"
                  }`}
                >
                  {item.refused ? "refused" : `${Math.round((item.confidence ?? 0) * 100)}%`}
                </span>
              </li>
            ))}
            {!questions.data?.length ? (
              <li className="text-sm text-muted-foreground">No questions asked yet.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}