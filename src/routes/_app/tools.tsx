import { createFileRoute, Link, Outlet, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import * as Icons from "lucide-react";
import { TOOLS, TOOL_CATEGORIES } from "@/lib/tools";

export const Route = createFileRoute("/_app/tools")({
  head: () => ({
    meta: [{ title: "AI Tools Marketplace — IntelliVerse" }],
  }),
  component: ToolsLayout,
});

function ToolsLayout() {
  const matches = useMatches();
  const slugMatch = matches.find((m) => (m.params as { slug?: string })?.slug);
  if ((slugMatch?.params as { slug?: string } | undefined)?.slug) return <Outlet />;
  return <ToolsMarketplace />;
}

function ToolsMarketplace() {
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");

  const filtered = TOOLS.filter((t) => {
    if (cat !== "All" && t.category !== cat) return false;
    if (q && !(`${t.name} ${t.tagline}`).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI Tools Marketplace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            25+ AI tools for study, career, coding, content, and business — all powered by IntelliVerse.
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {["All", ...TOOL_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  cat === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Icons.Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tools…"
              className="w-full rounded-md border border-border bg-background px-8 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[t.icon] ?? Icons.Sparkles;
            return (
              <Link
                key={t.slug}
                to="/tools/$slug"
                params={{ slug: t.slug }}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card"
              >
                <div className={`mb-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${t.accent} text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.category}
                </div>
                <h3 className="mt-1 text-base font-semibold">{t.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                  Open tool <Icons.ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="py-20 text-center text-sm text-muted-foreground">No tools match.</p>
        )}
      </div>
    </div>
  );
}
