import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Lumen Compliance Intelligence" },
      {
        name: "description",
        content:
          "Sign in to Lumen to ingest documents, explore your compliance knowledge graph and ask cited questions.",
      },
      { property: "og:title", content: "Sign in — Lumen" },
      {
        property: "og:description",
        content: "Private, owner-scoped access to your compliance knowledge graph.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      setPending(false);
      if (signUpError) return setError(signUpError.message);
      const { data } = await supabase.auth.getSession();
      if (data.session) return void navigate({ to: "/" });
      return setMessage("Check your inbox to confirm your address, then sign in.");
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setPending(false);
    if (signInError) return setError(signInError.message);
    void navigate({ to: "/" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="glass-card rise-in w-full max-w-sm p-7">
        <div className="flex items-center gap-3">
          <span className="breathe flex size-9 items-center justify-center rounded-xl bg-primary">
            <Activity className="size-4 text-primary-foreground" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">Lumen</span>
            <span className="block text-[11px] text-muted-foreground">
              GraphRAG Compliance
            </span>
          </span>
        </div>

        <h1 className="mt-6 text-lg font-semibold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create your workspace"}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Your documents, graph and answers are private to your account.
        </p>

        <form className="mt-5 space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {message ? <p className="text-xs text-success">{message}</p> : null}

          <Button type="submit" className="press w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setMessage(null);
          }}
        >
          {mode === "signin"
            ? "No account yet? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}