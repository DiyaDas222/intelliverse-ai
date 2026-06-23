import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import * as Icons from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { TOOLS_BY_SLUG, type ToolField } from "@/lib/tools";
import { CHAT_MODELS, DEFAULT_MODEL } from "@/lib/models";

export const Route = createFileRoute("/_app/tools/$slug")({
  loader: ({ params }) => {
    const tool = TOOLS_BY_SLUG[params.slug];
    if (!tool) throw notFound();
    return { tool };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.tool.name ?? "Tool"} — IntelliVerse` }],
  }),
  notFoundComponent: () => (
    <div className="grid h-full place-items-center p-10 text-center">
      <div>
        <h2 className="text-lg font-semibold">Tool not found</h2>
        <Link to="/tools" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to marketplace
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="grid h-full place-items-center p-10 text-center">
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    </div>
  ),
  component: ToolPage,
});

function ToolPage() {
  const { tool } = Route.useLoaderData();
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[tool.icon] ??
    Icons.Sparkles;
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(tool.fields.map((f: ToolField) => [f.name, ""])),
  );
  const [model, setModel] = useState<string>(
    (typeof localStorage !== "undefined" && localStorage.getItem("iv:model")) || DEFAULT_MODEL,
  );
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    for (const f of tool.fields) {
      if (f.required !== false && !values[f.name]?.trim()) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    setLoading(true);
    setOutput("");
    try {
      const res = await fetch("/api/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: tool.system,
          prompt: tool.buildPrompt(values),
        }),
      });
      if (!res.ok || !res.body) {
        if (res.status === 429) toast.error("Rate limit reached. Please retry.");
        else if (res.status === 402) toast.error("AI credits exhausted.");
        else toast.error((await res.text().catch(() => "")) || "AI request failed");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setOutput(acc);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied");
  };

  const download = () => {
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tool.slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          to="/tools"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Icons.ArrowLeft className="h-3 w-3" /> Tools
        </Link>

        <div className="mb-6 flex items-start gap-4">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tool.accent} text-white`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tool.category}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{tool.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{tool.tagline}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold">Input</h2>
            <div className="space-y-4">
              {tool.fields.map((f: ToolField) => (
                <div key={f.name}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {f.label} {f.required === false && <span className="text-muted-foreground/60">(optional)</span>}
                  </label>
                  {f.multiline ? (
                    <textarea
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={5}
                      className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  ) : (
                    <input
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  )}
                </div>
              ))}

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {CHAT_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.hint}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={run}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Icons.Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Icons.Sparkles className="h-4 w-4" /> Generate
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Output</h2>
              {output && !loading && (
                <div className="flex gap-1">
                  <button
                    onClick={copy}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                    title="Copy"
                  >
                    <Icons.Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={download}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                    title="Download as .md"
                  >
                    <Icons.Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="min-h-[260px]">
              {!output && !loading && (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  Your AI-generated result will appear here.
                </p>
              )}
              {loading && !output && (
                <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  Thinking…
                </div>
              )}
              {output && (
                <div className="prose-ai text-sm text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
