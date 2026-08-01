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
          <Link to="/" className="group mb-8 flex items-center gap-3 px-2">
            <span className="breathe flex size-9 items-center justify-center rounded-xl bg-primary transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              <Activity className="size-4 text-primary-foreground transition-transform duration-500 group-hover:scale-110" />
            </span>
            <span className="leading-tight transition-transform duration-300 group-hover:translate-x-0.5">
              <span className="block text-sm font-semibold tracking-tight">Lumen</span>
              <span className="block text-[11px] text-muted-foreground">
                GraphRAG Compliance
              </span>
            </span>
          </Link>

          <nav className="flex flex-col gap-1">
            {NAV.map((item, index) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                style={{ animationDelay: `${index * 55}ms` }}
                className="group rise-in relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:bg-secondary hover:text-foreground"
                activeProps={{
                  className:
                    "bg-secondary text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary",
                }}
              >
                <item.icon className="size-4 transition-transform duration-300 group-hover:scale-110" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="rise-in mt-auto rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground transition-colors duration-300 hover:border-primary/25">
            Answers are grounded in your uploaded documents. Anything unsupported by
            retrieved evidence is refused by the hallucination guard.
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rise-in">
                <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
                {subtitle ? (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
              <div className="rise-in [&_button]:press [&_a]:press" style={{ animationDelay: "80ms" }}>
                {actions}
              </div>
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="press whitespace-nowrap rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors duration-200"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <div key={title} className="rise-in px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}