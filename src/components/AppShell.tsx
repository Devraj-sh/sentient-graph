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
    <div className="grid-backdrop min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/60 px-4 py-6 lg:flex">
          <Link to="/" className="mb-8 flex items-center gap-3 px-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
              <Activity className="size-5 text-primary" />
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
                className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                activeProps={{
                  className: "bg-secondary text-foreground ring-1 ring-border",
                }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border border-border/60 bg-card/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Answers are grounded in your uploaded documents. Anything unsupported by
            retrieved evidence is refused by the hallucination guard.
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 px-6 py-4 backdrop-blur-xl">
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