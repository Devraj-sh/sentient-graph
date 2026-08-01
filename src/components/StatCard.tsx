import type { LucideIcon } from "lucide-react";

import { AnimatedNumber } from "@/components/AnimatedNumber";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  delay = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger";
  delay?: number;
}) {
  const toneClass = {
    primary: "text-primary bg-primary/12 ring-primary/25",
    success: "text-success bg-success/12 ring-success/25",
    warning: "text-warning bg-warning/12 ring-warning/25",
    danger: "text-danger bg-danger/12 ring-danger/25",
  }[tone];

  return (
    <div
      className="glass-card rise-in hover-lift group p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
          </p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <span
          className={`flex size-9 items-center justify-center rounded-lg ring-1 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${toneClass}`}
        >
          <Icon className="size-4 transition-transform duration-300" />
        </span>
      </div>
    </div>
  );
}