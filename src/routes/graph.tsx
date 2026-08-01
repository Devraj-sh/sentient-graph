import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { GraphCanvas } from "@/components/GraphCanvas";
import { Input } from "@/components/ui/input";
import { ENTITY_TYPES, entityColor } from "@/lib/domain";
import { entitiesQuery, relationshipsQuery } from "@/lib/queries";

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Knowledge Graph — ComplyGraph" },
      {
        name: "description",
        content:
          "Explore people, vendors, policies and risks and the relationships extracted from your documents.",
      },
      { property: "og:title", content: "Knowledge Graph — ComplyGraph" },
      {
        property: "og:description",
        content: "An interactive, force-directed view of your compliance knowledge graph.",
      },
    ],
  }),
  component: GraphPage,
});

function GraphPage() {
  const entities = useQuery(entitiesQuery);
  const relationships = useQuery(relationshipsQuery);
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const all = entities.data ?? [];
    const filtered = all
      .filter((entity) => (types.length ? types.includes(entity.type) : true))
      .filter((entity) =>
        search ? entity.name.toLowerCase().includes(search.toLowerCase()) : true,
      )
      .slice(0, 120);

    const ids = new Set(filtered.map((entity) => entity.id));
    return {
      nodes: filtered.map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        riskLevel: entity.risk_level,
        mentions: entity.mentions ?? 1,
      })),
      edges: (relationships.data ?? [])
        .filter((edge) => ids.has(edge.source_id) && ids.has(edge.target_id))
        .map((edge) => ({
          source: edge.source_id,
          target: edge.target_id,
          type: edge.type,
        })),
    };
  }, [entities.data, relationships.data, search, types]);

  const selectedEntity = (entities.data ?? []).find((entity) => entity.id === selected);
  const selectedEdges = (relationships.data ?? []).filter(
    (edge) => edge.source_id === selected || edge.target_id === selected,
  );
  const nameById = new Map((entities.data ?? []).map((entity) => [entity.id, entity.name]));
  const presentTypes = ENTITY_TYPES.filter((type) =>
    (entities.data ?? []).some((entity) => entity.type === type),
  );

  return (
    <AppShell
      title="Knowledge Graph"
      subtitle={`${nodes.length} entities · ${edges.length} relationships in view`}
      actions={
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search entities"
            className="w-56 pl-9"
          />
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {presentTypes.map((type) => {
          const active = types.includes(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() =>
                setTypes((current) =>
                  current.includes(type)
                    ? current.filter((item) => item !== type)
                    : [...current, type],
                )
              }
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entityColor(type) }}
              />
              {type}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="glass-card overflow-hidden">
          {nodes.length ? (
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              selectedId={selected}
              onSelect={setSelected}
            />
          ) : (
            <div className="flex h-[620px] items-center justify-center text-sm text-muted-foreground">
              No entities match the current filters. Ingest a document to build the graph.
            </div>
          )}
        </div>

        <aside className="glass-card h-fit p-5">
          {selectedEntity ? (
            <div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: `color-mix(in oklab, ${entityColor(selectedEntity.type)} 18%, transparent)`,
                  color: entityColor(selectedEntity.type),
                }}
              >
                {selectedEntity.type}
              </span>
              <h2 className="mt-2 text-base font-semibold">{selectedEntity.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Risk {selectedEntity.risk_level} · {selectedEntity.mentions} mentions
              </p>
              {selectedEntity.summary ? (
                <p className="mt-3 text-sm text-muted-foreground">{selectedEntity.summary}</p>
              ) : null}

              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Connections
              </h3>
              <ul className="mt-2 space-y-2">
                {selectedEdges.slice(0, 20).map((edge) => {
                  const outgoing = edge.source_id === selected;
                  const other = outgoing ? edge.target_id : edge.source_id;
                  return (
                    <li
                      key={edge.id}
                      className="rounded-lg border border-border/60 px-3 py-2 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {outgoing ? "→" : "←"} {edge.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelected(other)}
                        className="mt-0.5 block text-left text-sm font-medium hover:underline"
                      >
                        {nameById.get(other) ?? "Unknown"}
                      </button>
                      {edge.evidence ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          “{edge.evidence}”
                        </p>
                      ) : null}
                    </li>
                  );
                })}
                {!selectedEdges.length ? (
                  <li className="text-xs text-muted-foreground">No relationships recorded.</li>
                ) : null}
              </ul>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              <h2 className="text-sm font-semibold text-foreground">Inspector</h2>
              <p className="mt-2 text-xs">
                Select any node to see its risk level, extracted summary and every
                relationship discovered across your documents.
              </p>
              <div className="mt-4 space-y-2">
                {(entities.data ?? []).slice(0, 8).map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => setSelected(entity.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-left text-xs hover:bg-secondary/60"
                  >
                    <span className="truncate">{entity.name}</span>
                    <span className="shrink-0 text-muted-foreground">{entity.mentions}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}