import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authedFetch } from "@/lib/authed-fetch";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import Editor from "@monaco-editor/react";
import JSZip from "jszip";
import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  Github,
  Loader2,
  Plus,
  RefreshCcw,
  Rocket,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GithubPublishDialog } from "@/components/github-publish-dialog";
import { Textarea } from "@/components/ui/textarea";
import { VibePhases, usePhaseRunner } from "@/components/vibe-phases";
import { buildPreviewDoc } from "@/lib/build-preview";
import {
  getVibeProject, updateVibeProject, deployVibeProject,
  type VibeFile, type VibeMessage, type VibeProject,
} from "@/lib/vibe.functions";

export const Route = createFileRoute("/_app/studio/vibe/$id")({
  component: VibeWorkspace,
});

const EXT_TO_LANG: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", jsx: "javascript",
  html: "html", htm: "html", css: "css", json: "json",
  py: "python", rb: "ruby", go: "go", rs: "rust",
  java: "java", kt: "kotlin", swift: "swift", dart: "dart",
  php: "php", sql: "sql", sh: "shell", yml: "yaml", yaml: "yaml",
  md: "markdown", xml: "xml", env: "plaintext", toml: "plaintext",
};

function langFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "plaintext";
}

function VibeWorkspace() {
  const { id } = Route.useParams();
  const get = useServerFn(getVibeProject);
  const update = useServerFn(updateVibeProject);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["vibeProject", id],
    queryFn: () => get({ data: { id } }),
  });

  const [files, setFiles] = useState<VibeFile[]>([]);
  const [messages, setMessages] = useState<VibeMessage[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project) {
      setFiles(project.files ?? []);
      setMessages(project.messages ?? []);
      setActivePath((project.files ?? [])[0]?.path ?? null);
      setDirty(false);

      // Auto-run the first generation when the chat wizard handed us a brief.
      const key = `iv:vibe-auto:${project.id}`;
      const pending = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
      if (pending && (project.files ?? []).length === 0) {
        sessionStorage.removeItem(key);
        setPrompt(pending);
        // defer so state settles before we call generate()
        setTimeout(() => { void generate(pending); }, 50);
      }
    }
  }, [project?.id]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, generating]);

  const active = files.find((f) => f.path === activePath) ?? null;

  const previewDoc = useMemo(() => buildPreviewDoc(files, project?.entry_file ?? null), [files, project?.entry_file]);
  const canPreview = !!previewDoc;

  const saveMut = useMutation({
    mutationFn: async (patch: Partial<VibeProject>) => {
      return update({
        data: {
          id,
          files: patch.files ?? files,
          messages: patch.messages ?? messages,
          entry_file: patch.entry_file ?? project?.entry_file ?? null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vibeProject", id] });
      qc.invalidateQueries({ queryKey: ["vibeProjects"] });
      setDirty(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  async function generate(overrideText?: string) {
    const text = (overrideText ?? prompt).trim();
    if (!text || generating || !project) return;
    setGenerating(true);
    const userMsg: VibeMessage = { role: "user", content: text, at: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setPrompt("");

    try {
      const res = await authedFetch("/api/vibe-generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          kind: project.kind,
          stack: project.stack,
          files,
          messages: nextMessages,
          mode: files.length ? "modify" : "scaffold",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || `Generation failed (${res.status})`);
      }

      const merged = mergeFiles(files, data.files ?? []);
      const questions: string[] = data.questions ?? [];
      const reply =
        (data.summary || "Done.") +
        (questions.length ? `\n\n**A few questions:**\n${questions.map((q: string) => `- ${q}`).join("\n")}` : "") +
        (data.notes ? `\n\n${data.notes}` : "");

      const assistantMsg: VibeMessage = { role: "assistant", content: reply, at: new Date().toISOString() };
      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      setFiles(merged);
      const newEntry = data.entry_file || project.entry_file || guessEntry(merged);
      if (!activePath && merged[0]) setActivePath(merged[0].path);

      await update({
        data: { id, files: merged, messages: finalMessages, entry_file: newEntry },
      });
      qc.invalidateQueries({ queryKey: ["vibeProject", id] });
      qc.invalidateQueries({ queryKey: ["vibeProjects"] });
      toast.success(`Updated ${data.files?.length ?? 0} file(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${e?.message ?? "Generation failed"}`, at: new Date().toISOString() }]);
    } finally {
      setGenerating(false);
    }
  }

  function updateActiveContent(value: string) {
    if (!active) return;
    setFiles((fs) => fs.map((f) => (f.path === active.path ? { ...f, content: value } : f)));
    setDirty(true);
  }

  function addFile() {
    const path = prompt_input("New file path (e.g. src/utils.ts):");
    if (!path) return;
    if (files.some((f) => f.path === path)) return toast.error("File already exists");
    const next = [...files, { path, content: "" }];
    setFiles(next);
    setActivePath(path);
    setDirty(true);
  }

  function deleteFile(path: string) {
    if (!confirm(`Delete ${path}?`)) return;
    const next = files.filter((f) => f.path !== path);
    setFiles(next);
    if (activePath === path) setActivePath(next[0]?.path ?? null);
    setDirty(true);
  }

  async function downloadZip() {
    if (files.length === 0) return toast.error("Nothing to download yet");
    const zip = new JSZip();
    for (const f of files) zip.file(f.path, f.content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name?.replace(/[^a-z0-9-_]+/gi, "_") || "vibe-project"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (error || !project) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-sm text-destructive">{(error as any)?.message || "Project not found"}</p>
          <Button className="mt-3" variant="outline" onClick={() => navigate({ to: "/studio/vibe" })}>
            Back to Vibe Coding
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-card/40 px-3 py-2">
        <Link to="/studio/vibe" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500">
          <Code2 className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{project.name}</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {project.kind} · {(project.stack as any)?.frontend ?? "—"}
            {(project.stack as any)?.backend && (project.stack as any).backend !== "None" ? ` · ${(project.stack as any).backend}` : ""}
            {(project.stack as any)?.database && (project.stack as any).database !== "None" ? ` · ${(project.stack as any).database}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <Button size="sm" variant="outline" onClick={() => saveMut.mutate({ files, messages })} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save
            </Button>
          )}
          <Button size="sm" variant={previewOpen ? "default" : "outline"} onClick={() => setPreviewOpen((v) => !v)} disabled={!canPreview}>
            <Eye className="mr-1 h-3.5 w-3.5" /> Preview
          </Button>
          <Button size="sm" variant="outline" onClick={downloadZip}>
            <Download className="mr-1 h-3.5 w-3.5" /> ZIP
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)} disabled={files.length === 0}>
            <Github className="mr-1 h-3.5 w-3.5" /> Publish
          </Button>
        </div>
      </div>

      <GithubPublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        files={files.map((f) => ({ path: f.path, content: f.content }))}
        defaultRepoName={(project?.name || "vibe-project").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80)}
        defaultDescription={project?.description ?? ""}
        sourceKind="vibe"
        sourceId={id}
      />

      <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[220px_1fr_380px]">
        {/* File tree */}
        <aside className="hidden min-h-0 flex-col border-r border-border/60 bg-card/30 lg:flex">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
            Files
            <button onClick={addFile} className="rounded p-1 hover:text-foreground" title="Add file">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {files.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">
                No files yet. Describe your project in the chat to generate.
              </p>
            )}
            {files.map((f) => (
              <div
                key={f.path}
                className={`group flex items-center gap-1 px-2 py-1 text-xs ${activePath === f.path ? "bg-muted" : "hover:bg-muted/60"}`}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  onClick={() => setActivePath(f.path)}
                >
                  <FileCode2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{f.path}</span>
                </button>
                <button
                  onClick={() => deleteFile(f.path)}
                  className="opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Editor + Preview */}
        <section className="flex min-h-0 flex-col">
          <div className={`grid min-h-0 flex-1 ${previewOpen && canPreview ? "grid-rows-2" : "grid-rows-1"}`}>
            <div className="min-h-0 border-b border-border/60">
              {active ? (
                <Editor
                  height="100%"
                  language={langFor(active.path)}
                  value={active.content}
                  onChange={(v) => updateActiveContent(v ?? "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  }}
                />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
                  <div>
                    <Sparkles className="mx-auto mb-2 h-6 w-6" />
                    Describe what you want in the chat panel — the AI will scaffold the files.
                  </div>
                </div>
              )}
            </div>
            {previewOpen && canPreview && (
              <div className="min-h-0 bg-white">
                <iframe
                  title="preview"
                  className="h-full w-full"
                  sandbox="allow-scripts allow-forms allow-modals"
                  srcDoc={previewDoc}
                />
              </div>
            )}
          </div>
        </section>

        {/* Chat */}
        <aside className="flex min-h-0 flex-col border-t border-border/60 bg-card/20 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Vibe Chat</span>
            <span className="ml-auto text-[10px] text-muted-foreground">Memory: {messages.length} msgs</span>
          </div>
          <div ref={chatRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                Try: <em>"Build me a portfolio with a hero, projects grid, and contact form."</em><br/>
                Then iterate: <em>"Add dark mode"</em>, <em>"Use Next.js instead"</em>, <em>"Add an admin panel"</em>.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-4 whitespace-pre-wrap rounded-lg bg-primary/10 px-3 py-2"
                    : "mr-4 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 leading-relaxed"
                }
              >
                {m.content}
              </div>
            ))}
            {generating && (
              <div className="mr-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating files…
              </div>
            )}
          </div>
          <div className="border-t border-border/60 p-2">
            <div className="flex items-end gap-2">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    generate();
                  }
                }}
                placeholder="Describe what to build or change…"
                className="min-h-[44px] resize-none text-sm"
              />
              <Button size="icon" onClick={() => generate()} disabled={generating || !prompt.trim()}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function prompt_input(label: string): string | null {
  // eslint-disable-next-line no-alert
  return window.prompt(label);
}

function mergeFiles(existing: VibeFile[], incoming: VibeFile[]): VibeFile[] {
  const map = new Map(existing.map((f) => [f.path, f]));
  for (const f of incoming) map.set(f.path, f);
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path));
}

function guessEntry(files: VibeFile[]): string | null {
  const html = files.find((f) => /(^|\/)index\.html$/i.test(f.path));
  if (html) return html.path;
  return null;
}

function buildPreviewDoc(files: VibeFile[], entry: string | null): string | null {
  const entryFile =
    (entry && files.find((f) => f.path === entry)) ||
    files.find((f) => /(^|\/)index\.html$/i.test(f.path));
  if (!entryFile) return null;

  let html = entryFile.content;
  const dir = entryFile.path.includes("/") ? entryFile.path.replace(/\/[^/]+$/, "/") : "";

  // Inline <link rel="stylesheet" href="...">
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (m, href) => {
    const resolved = resolvePath(dir, href);
    const css = files.find((f) => f.path === resolved);
    return css ? `<style>\n${css.content}\n</style>` : m;
  });

  // Inline <script src="..."></script>
  html = html.replace(/<script([^>]*)\s+src=["']([^"']+)["']([^>]*)><\/script>/gi, (m, pre, src, post) => {
    const resolved = resolvePath(dir, src);
    const js = files.find((f) => f.path === resolved);
    return js ? `<script${pre}${post}>\n${js.content}\n</script>` : m;
  });

  return html;
}

function resolvePath(dir: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return href.replace(/^\/+/, "");
  const parts = (dir + href).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}
