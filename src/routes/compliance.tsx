import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { RISK_WEIGHT } from "@/lib/domain";
import { documentsQuery, entitiesQuery, findingsQuery, questionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance & Risk — Lumen" },
      {
        name: "description",
        content:
          "Track compliance findings by severity and category, and audit every answer the system has produced.",
      },
      { property: "og:title", content: "Compliance & Risk — Lumen" },
      {
        property: "og:description",
        content: "Severity-ranked findings and a full audit trail of grounded answers.",
      },
    ],
  }),
  component: CompliancePage,
});

const SEVERITIES = ["critical", "high", "medium", "low"] as const;

function CompliancePage() {
  const findings = useQuery(findingsQuery);
  const entities = useQuery(entitiesQuery);
  const documents = useQuery(documentsQuery);
  const questions = useQuery(questionsQuery);
  const [severity, setSeverity] = useState<string | null>(null);

  const rows = findings.data ?? [];
  const filtered = severity ? rows.filter((row) => row.severity === severity) : rows;

  const nameById = new Map((entities.data ?? []).map((entity) => [entity.id, entity.name]));
  const documentById = new Map((documents.data ?? []).map((doc) => [doc.id, doc.name]));

  const counts = useMemo(
    () =>
      SEVERITIES.reduce<Record<string, number>>((acc, level) => {
        acc[level] = rows.filter((row) => row.severity === level).length;
        return acc;
      }, {}),
    [rows],
  );

  const riskScore = Math.min(
    100,
    rows.reduce((total, row) => total + (RISK_WEIGHT[row.severity] ?? 1), 0),
  );

  const categories = Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      const key = row.category ?? "General";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const audits = questions.data ?? [];
  const refusalRate = audits.length
    ? Math.round((audits.filter((item) => item.refused).length / audits.length) * 100)
    : 0;

  return (
    <AppShell
      title="Compliance & Risk"
      subtitle="Every finding is traceable to a document, a page and a graph entity."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Risk score"
          value={riskScore}
          hint="Weighted by severity"
          icon={ShieldAlert}
          tone={riskScore > 60 ? "danger" : riskScore > 25 ? "warning" : "success"}
        />
        <StatCard
          label="Critical + high"
          value={(counts["critical"] ?? 0) + (counts["high"] ?? 0)}
          hint="Require immediate review"
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Total findings"
          value={rows.length}
          hint={`${categories.length} categories`}
          icon={ShieldAlert}
          tone="warning"
        />
        <StatCard
          label="Guard refusal rate"
          value={`${refusalRate}%`}
          hint={`${audits.length} audited answers`}
          icon={ShieldCheck}
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <section className="glass-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
            <h2 className="text-sm font-semibold">Findings</h2>
            <div className="flex gap-1.5">
              {SEVERITIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSeverity(severity === level ? null : level)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition-colors ${
                    severity === level
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level} · {counts[level] ?? 0}
                </button>
              ))}
            </div>
          </div>

          <ul className="divide-y divide-border/60">
            {filtered.map((finding) => (
              <li key={finding.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{finding.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{finding.detail}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {finding.category}
                      {finding.entity_id ? ` · ${nameById.get(finding.entity_id) ?? ""}` : ""}
                      {finding.document_id
                        ? ` · ${documentById.get(finding.document_id) ?? "document"} p.${finding.page ?? 1}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ring-1 ${
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
              </li>
            ))}
            {!filtered.length ? (
              <li className="px-5 py-8 text-sm text-muted-foreground">
                No findings for this filter.
              </li>
            ) : null}
          </ul>
        </section>

        <aside className="space-y-4">
          <section className="glass-card p-5">
            <h2 className="text-sm font-semibold">By category</h2>
            <ul className="mt-3 space-y-2">
              {categories.slice(0, 8).map(([category, count]) => (
                <li key={category} className="flex items-center justify-between text-xs">
                  <span className="truncate">{category}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </li>
              ))}
              {!categories.length ? (
                <li className="text-xs text-muted-foreground">No categories yet.</li>
              ) : null}
            </ul>
          </section>

          <section className="glass-card p-5">
            <h2 className="text-sm font-semibold">Answer audit trail</h2>
            <ul className="mt-3 space-y-2">
              {audits.slice(0, 10).map((item) => (
                <li key={item.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="truncate text-xs">{item.question}</p>
                  <p
                    className={`mt-1 text-[11px] ${item.refused ? "text-warning" : "text-success"}`}
                  >
                    {item.refused
                      ? "refused — insufficient evidence"
                      : `answered · ${Math.round((item.confidence ?? 0) * 100)}% confidence`}
                  </p>
                </li>
              ))}
              {!audits.length ? (
                <li className="text-xs text-muted-foreground">No questions asked yet.</li>
              ) : null}
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}