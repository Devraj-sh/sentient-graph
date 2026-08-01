import { Link } from "@tanstack/react-router";
import {
  Activity,
  LayoutDashboard,
  MessagesSquare,
  Network,
  ShieldAlert,
  Upload,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/ingest", label: "Ingestion", icon: Upload },
  { to: "/graph", label: "Knowledge Graph", icon: Network },
  { to: "/chat", label: "GraphRAG Chat", icon: MessagesSquare },
  { to: "/compliance", label: "Compliance", icon: ShieldAlert },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border px-4 py-6 lg:flex">
          <Link to="/" className="mb-8 flex items-center gap-3 px-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary">
              <Activity className="size-4 text-primary-foreground" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">Lumen</span>
              <span className="block text-[11px] text-muted-foreground">
                GraphRAG Compliance
              </span>
            </span>
          </Link>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{
                  className: "bg-secondary text-foreground",
                }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">
            Answers are grounded in your uploaded documents. Anything unsupported by
            retrieved evidence is refused by the hallucination guard.
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
                {subtitle ? (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
              {actions}
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="whitespace-nowrap rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <div className="px-6 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}