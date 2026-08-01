import { useEffect, useMemo, useRef, useState } from "react";

import { entityColor } from "@/lib/domain";

export type GraphNodeInput = {
  id: string;
  name: string;
  type: string;
  riskLevel: string;
  mentions: number;
};

export type GraphEdgeInput = { source: string; target: string; type: string };

type Simulated = GraphNodeInput & { x: number; y: number; vx: number; vy: number };

const WIDTH = 1000;
const HEIGHT = 620;

/** Lightweight force-directed graph rendered as SVG — no external graph library. */
export function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
}: {
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [positions, setPositions] = useState<Simulated[]>([]);
  const frame = useRef<number | null>(null);

  const key = useMemo(
    () => `${nodes.map((node) => node.id).join(",")}|${edges.length}`,
    [nodes, edges.length],
  );

  useEffect(() => {
    if (!nodes.length) {
      setPositions([]);
      return;
    }

    const simulated: Simulated[] = nodes.map((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      const radius = 120 + (index % 7) * 28;
      return {
        ...node,
        x: WIDTH / 2 + Math.cos(angle) * radius,
        y: HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });

    const indexById = new Map(simulated.map((node, index) => [node.id, index]));
    const links = edges
      .map((edge) => ({
        source: indexById.get(edge.source),
        target: indexById.get(edge.target),
      }))
      .filter(
        (link): link is { source: number; target: number } =>
          link.source !== undefined && link.target !== undefined,
      );

    let alpha = 1;

    const step = () => {
      for (let i = 0; i < simulated.length; i += 1) {
        const a = simulated[i]!;
        for (let j = i + 1; j < simulated.length; j += 1) {
          const b = simulated[j]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy) || 0.01;
          if (distance > 420) continue;
          const force = (2600 / (distance * distance)) * alpha;
          dx /= distance;
          dy /= distance;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }

      for (const link of links) {
        const a = simulated[link.source]!;
        const b = simulated[link.target]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        const force = ((distance - 140) * 0.012) * alpha;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const node of simulated) {
        node.vx += (WIDTH / 2 - node.x) * 0.0016 * alpha;
        node.vy += (HEIGHT / 2 - node.y) * 0.0016 * alpha;
        node.vx *= 0.86;
        node.vy *= 0.86;
        node.x = Math.min(WIDTH - 40, Math.max(40, node.x + node.vx));
        node.y = Math.min(HEIGHT - 40, Math.max(40, node.y + node.vy));
      }

      alpha *= 0.985;
      setPositions(simulated.map((node) => ({ ...node })));
      if (alpha > 0.02) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [key, nodes, edges]);

  const byId = new Map(positions.map((node) => [node.id, node]));
  const neighbours = new Set<string>();
  if (selectedId) {
    for (const edge of edges) {
      if (edge.source === selectedId) neighbours.add(edge.target);
      if (edge.target === selectedId) neighbours.add(edge.source);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-[620px] w-full touch-none select-none"
      onClick={() => onSelect(null)}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="18"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" opacity="0.5" />
        </marker>
      </defs>

      {edges.map((edge, index) => {
        const source = byId.get(edge.source);
        const target = byId.get(edge.target);
        if (!source || !target) return null;
        const highlighted =
          !selectedId || edge.source === selectedId || edge.target === selectedId;
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;

        return (
          <g key={`${edge.source}-${edge.target}-${edge.type}-${index}`}>
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke="currentColor"
              className="text-border"
              strokeWidth={highlighted ? 1.4 : 0.6}
              opacity={highlighted ? 0.85 : 0.2}
              markerEnd="url(#arrow)"
            />
            {selectedId && highlighted ? (
              <text
                x={midX}
                y={midY - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {edge.type}
              </text>
            ) : null}
          </g>
        );
      })}

      {positions.map((node) => {
        const dimmed = selectedId && node.id !== selectedId && !neighbours.has(node.id);
        const radius = Math.min(22, 8 + Math.sqrt(node.mentions) * 3);
        const color = entityColor(node.type);

        return (
          <g
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
            opacity={dimmed ? 0.22 : 1}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id === selectedId ? null : node.id);
            }}
          >
            {node.riskLevel === "critical" || node.riskLevel === "high" ? (
              <circle r={radius + 6} fill="none" stroke="var(--danger)" opacity={0.35} />
            ) : null}
            <circle
              r={radius}
              fill={color}
              fillOpacity={node.id === selectedId ? 0.95 : 0.7}
              stroke={color}
              strokeWidth={node.id === selectedId ? 3 : 1}
            />
            <text
              y={radius + 12}
              textAnchor="middle"
              className="fill-foreground text-[10px] font-medium"
            >
              {node.name.length > 22 ? `${node.name.slice(0, 21)}…` : node.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}