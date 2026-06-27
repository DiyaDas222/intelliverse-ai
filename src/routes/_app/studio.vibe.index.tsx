import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { authedFetch } from "@/lib/authed-fetch";
import {
  Code2,
  Plus,
  Trash2,
  Loader2,
  Globe,
  AppWindow,
  Smartphone,
  Database,
  LayoutDashboard,
  Sparkles,
  ExternalLink,
  Rocket,
  Download,
  Pencil,
} from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  listVibeProjects, createVibeProject, deleteVibeProject, deployVibeProject,
} from "@/lib/vibe.functions";

export const Route = createFileRoute("/_app/studio/vibe/")({
  component: VibeHub,
});

const KINDS = [
  { id: "website", label: "Website", icon: Globe },
  { id: "webapp", label: "Web App / SaaS", icon: AppWindow },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "mobile", label: "Mobile App", icon: Smartphone },
  { id: "api", label: "API / Backend", icon: Database },
];

const FRONTEND = ["React", "Next.js", "Vue", "Svelte", "Plain HTML/CSS/JS", "React Native", "Flutter"];
const BACKEND = ["None", "Node.js (Express)", "Next.js API", "Flask", "FastAPI", "Hono", "NestJS"];
const DATABASE = ["None", "PostgreSQL", "MongoDB", "MySQL", "SQLite", "Firebase", "Supabase"];
const AUTH = ["None", "Email/Password", "Google OAuth", "Magic Link", "Firebase Auth", "Supabase Auth"];
const STYLING = ["Tailwind CSS", "Plain CSS", "Material UI", "Bootstrap", "shadcn/ui"];

function VibeHub() {
  const list = useServerFn(listVibeProjects);
  const create = useServerFn(createVibeProject);
  const del = useServerFn(deleteVibeProject);
  const deployFn = useServerFn(deployVibeProject);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["vibeProjects"],
    queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    kind: "website",
    frontend: "React",
    backend: "None",
    database: "None",
    auth: "None",
    styling: "Tailwind CSS",
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name your project first");
      if (!form.description.trim()) throw new Error("Describe what to build first");
      const res = await authedFetch("/api/vibe-start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          kind: form.kind,
          stack: {
            frontend: form.frontend,
            backend: form.backend,
            database: form.database,
            auth: form.auth,
            styling: form.styling,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.project?.id) throw new Error(data?.error || "Failed to build");
      return data.project;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["vibeProjects"] });
      setOpen(false);
      toast.success("Built and deployed");
      navigate({ to: "/studio/vibe/$id", params: { id: p.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to build"),
  });

  const visibleProjects = projects.filter((p) => {
    const status = p.deploy_status ?? "idle";
    return (p.files?.length ?? 0) > 0 || status === "deployed" || status === "deploying" || status === "failed";
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vibeProjects"] });
      toast.success("Project deleted");
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <Code2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Vibe Coding</h1>
            <p className="text-sm text-muted-foreground">
              Describe what you want — websites, apps, APIs, dashboards — and edit them through chat.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">
            <Plus className="mr-1 h-4 w-4" /> New project
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your projects…
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold">No projects yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Start your first vibe — a portfolio, SaaS, dashboard or anything else. The AI will build it
              file-by-file and you can keep refining it with chat.
            </p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((p) => {
              const k = KINDS.find((x) => x.id === p.kind) ?? KINDS[0];
              const status = p.deploy_status ?? "draft";
              const statusStyles: Record<string, string> = {
                deployed: "bg-emerald-500/15 text-emerald-500",
                building: "bg-amber-500/15 text-amber-500",
                failed: "bg-red-500/15 text-red-500",
                draft: "bg-muted text-muted-foreground",
                idle: "bg-muted text-muted-foreground",
              };
              return (
                <div key={p.id} className="group relative flex flex-col rounded-2xl border border-border/60 bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/50">
                  <Link to="/studio/vibe/$id" params={{ id: p.id }} className="block">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/20">
                        <k.icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs text-muted-foreground">{k.label}</span>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[status] ?? statusStyles.draft}`}>
                        {status}
                      </span>
                    </div>
                    <h3 className="line-clamp-1 text-base font-semibold">{p.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.description || "No description"}
                    </p>
                    <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {(p.files?.length ?? 0)} file{(p.files?.length ?? 0) === 1 ? "" : "s"} · v{p.version ?? 1} ·
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  </Link>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-3">
                    {status === "deployed" && p.slug ? (
                      <a
                        href={`/live/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] font-medium text-emerald-500 hover:bg-emerald-500/25"
                      >
                        <ExternalLink className="h-3 w-3" /> Live
                      </a>
                    ) : null}
                    <Link
                      to="/studio/vibe/$id"
                      params={{ id: p.id }}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-muted/70"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </Link>
                    <button
                      onClick={async () => {
                        try {
                          await deployFn({ data: { id: p.id } });
                          qc.invalidateQueries({ queryKey: ["vibeProjects"] });
                          toast.success("Redeployed");
                        } catch (e: any) {
                          toast.error(e?.message ?? "Redeploy failed");
                        }
                      }}
                      disabled={(p.files?.length ?? 0) === 0}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-muted/70 disabled:opacity-40"
                    >
                      <Rocket className="h-3 w-3" /> Redeploy
                    </button>
                    <button
                      onClick={async () => {
                        const zip = new JSZip();
                        (p.files ?? []).forEach((f: any) => zip.file(f.path, f.content));
                        const blob = await zip.generateAsync({ type: "blob" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `${p.name}.zip`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-muted/70"
                    >
                      <Download className="h-3 w-3" /> ZIP
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.name}"? This cannot be undone.`)) delMut.mutate(p.id);
                    }}
                    className="absolute right-3 top-3 rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Start a new vibe</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Project name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Coffee shop landing" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">What do you want to build?</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A modern landing page for a coffee shop with menu, story, and contact form."
                className="min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StackPicker label="Type" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={KINDS.map((k) => ({ value: k.id, label: k.label }))} />
              <StackPicker label="Frontend" value={form.frontend} onChange={(v) => setForm({ ...form, frontend: v })} options={FRONTEND.map((v) => ({ value: v, label: v }))} />
              <StackPicker label="Backend" value={form.backend} onChange={(v) => setForm({ ...form, backend: v })} options={BACKEND.map((v) => ({ value: v, label: v }))} />
              <StackPicker label="Database" value={form.database} onChange={(v) => setForm({ ...form, database: v })} options={DATABASE.map((v) => ({ value: v, label: v }))} />
              <StackPicker label="Auth" value={form.auth} onChange={(v) => setForm({ ...form, auth: v })} options={AUTH.map((v) => ({ value: v, label: v }))} />
              <StackPicker label="Styling" value={form.styling} onChange={(v) => setForm({ ...form, styling: v })} options={STYLING.map((v) => ({ value: v, label: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Generate & deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StackPicker({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
