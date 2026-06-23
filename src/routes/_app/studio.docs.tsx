import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Presentation,
  GraduationCap,
  FolderGit2,
  Loader2,
  Sparkles,
  Download,
  Save,
  ChevronLeft,
} from "lucide-react";
import { saveDocAsset } from "@/lib/assets.functions";

export const Route = createFileRoute("/_app/studio/docs")({
  head: () => ({ meta: [{ title: "Document Generator — IntelliVerse" }] }),
  component: DocsPage,
});

type DocKind = "presentation" | "assignment" | "project";

type Slide = { title: string; bullets: string[]; notes?: string };
type Section = { heading: string; body: string };
type ProjectFile = { path: string; language?: string; content: string };

type PresentationContent = { title: string; subtitle?: string; slides: Slide[] };
type AssignmentContent = { title: string; subject?: string; sections: Section[]; references?: string[] };
type ProjectContent = {
  title: string;
  summary: string;
  stack: string[];
  features: string[];
  schema: string;
  files: ProjectFile[];
  readme: string;
  deployment: string;
};

type AnyContent = PresentationContent | AssignmentContent | ProjectContent;

const KINDS: { id: DocKind; label: string; icon: any; tint: string; placeholder: string }[] = [
  {
    id: "presentation",
    label: "Presentation",
    icon: Presentation,
    tint: "from-violet-500/30 to-purple-500/10",
    placeholder: "10-slide investor pitch for an AI-powered learning platform",
  },
  {
    id: "assignment",
    label: "Assignment",
    icon: GraduationCap,
    tint: "from-emerald-500/30 to-teal-500/10",
    placeholder: "College report on the impact of generative AI on education (5 sections)",
  },
  {
    id: "project",
    label: "Project",
    icon: FolderGit2,
    tint: "from-blue-500/30 to-cyan-500/10",
    placeholder: "Full-stack expense tracker with React, Supabase auth, charts dashboard",
  },
];

function DocsPage() {
  const [kind, setKind] = useState<DocKind>("presentation");
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState<AnyContent | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const qc = useQueryClient();
  const saveFn = useServerFn(saveDocAsset);

  async function generate() {
    if (!prompt.trim() || genBusy) return;
    setGenBusy(true);
    setContent(null);
    try {
      const r = await fetch("/api/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { content: AnyContent };
      setContent(data.content);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenBusy(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!content) return;
      return saveFn({
        data: {
          kind,
          title: content.title || prompt.slice(0, 60),
          prompt,
          content,
        },
      });
    },
    onSuccess: () => {
      toast.success("Saved to Library");
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function exportFile() {
    if (!content) return;
    try {
      if (kind === "presentation") await exportPptx(content as PresentationContent);
      else if (kind === "assignment") await exportDocx(content as AssignmentContent);
      else await exportProjectZip(content as ProjectContent);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/studio" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3 w-3" /> Studio
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-semibold sm:text-2xl">Document Generator</h1>
          <p className="text-xs text-muted-foreground">Presentations, assignments, and full project scaffolds — exportable.</p>
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => {
                setKind(k.id);
                setContent(null);
              }}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                kind === k.id
                  ? "border-primary bg-gradient-to-br " + k.tint
                  : "border-border/60 bg-card/40 hover:border-primary/40"
              }`}
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-background/80">
                <k.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{k.label}</div>
                <div className="text-[10px] text-muted-foreground">{k.id === "project" ? "Code + README + SQL" : k.id === "assignment" ? "DOCX export" : "PPTX export"}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
          <label className="text-xs font-medium text-muted-foreground">Describe what to generate</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={KINDS.find((k) => k.id === kind)?.placeholder}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={generate}
            disabled={!prompt.trim() || genBusy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {genBusy ? "Generating…" : `Generate ${kind}`}
          </button>
        </div>

        {content && (
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{content.title}</h2>
                {kind === "presentation" && (content as PresentationContent).subtitle && (
                  <p className="text-xs text-muted-foreground">{(content as PresentationContent).subtitle}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-sidebar-accent disabled:opacity-50"
                >
                  {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </button>
                <button
                  onClick={exportFile}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <Download className="h-3 w-3" /> Export
                </button>
              </div>
            </div>

            <Preview kind={kind} content={content} />
          </div>
        )}
      </div>
    </div>
  );
}

function Preview({ kind, content }: { kind: DocKind; content: AnyContent }) {
  if (kind === "presentation") {
    const c = content as PresentationContent;
    return (
      <div className="space-y-3">
        {c.slides?.map((s, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Slide {i + 1}</div>
            <h3 className="font-medium">{s.title}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {s.bullets?.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
            {s.notes && <p className="mt-2 text-xs italic text-muted-foreground">📝 {s.notes}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "assignment") {
    const c = content as AssignmentContent;
    return (
      <div className="space-y-4">
        {c.subject && <p className="text-xs text-muted-foreground">Subject: {c.subject}</p>}
        {c.sections?.map((s, i) => (
          <div key={i}>
            <h3 className="font-medium">{s.heading}</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
        {c.references && c.references.length > 0 && (
          <div>
            <h3 className="font-medium">References</h3>
            <ul className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
              {c.references.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }
  const c = content as ProjectContent;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{c.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {c.stack?.map((s) => (
          <span key={s} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{s}</span>
        ))}
      </div>
      <div>
        <h3 className="text-sm font-medium">Features</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {c.features?.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-medium">Files ({c.files?.length ?? 0})</h3>
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {c.files?.map((f) => <li key={f.path} className="font-mono">📄 {f.path}</li>)}
        </ul>
      </div>
    </div>
  );
}

async function exportPptx(c: PresentationContent) {
  const PptxGen = (await import("pptxgenjs")).default;
  const pptx = new PptxGen();
  pptx.layout = "LAYOUT_WIDE";

  const title = pptx.addSlide();
  title.background = { color: "0F172A" };
  title.addText(c.title, {
    x: 0.5, y: 2.2, w: 12, h: 1.2, fontSize: 44, bold: true, color: "FFFFFF", align: "center",
  });
  if (c.subtitle) {
    title.addText(c.subtitle, {
      x: 0.5, y: 3.6, w: 12, h: 0.6, fontSize: 20, color: "94A3B8", align: "center",
    });
  }

  for (const s of c.slides ?? []) {
    const slide = pptx.addSlide();
    slide.addText(s.title, { x: 0.5, y: 0.4, w: 12, h: 0.8, fontSize: 28, bold: true, color: "0F172A" });
    slide.addText(
      (s.bullets ?? []).map((b) => ({ text: b, options: { bullet: true } })),
      { x: 0.7, y: 1.4, w: 11.6, h: 5.5, fontSize: 18, color: "334155", paraSpaceAfter: 8 },
    );
    if (s.notes) slide.addNotes(s.notes);
  }
  await pptx.writeFile({ fileName: `${safe(c.title)}.pptx` });
}

async function exportDocx(c: AssignmentContent) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");
  const { saveAs } = await import("file-saver");
  const children: any[] = [
    new Paragraph({ text: c.title, heading: HeadingLevel.TITLE }),
  ];
  if (c.subject) children.push(new Paragraph({ children: [new TextRun({ text: c.subject, italics: true })] }));
  for (const s of c.sections ?? []) {
    children.push(new Paragraph({ text: s.heading, heading: HeadingLevel.HEADING_1 }));
    for (const p of s.body.split(/\n+/)) {
      children.push(new Paragraph({ text: p }));
    }
  }
  if (c.references?.length) {
    children.push(new Paragraph({ text: "References", heading: HeadingLevel.HEADING_1 }));
    c.references.forEach((r, i) => children.push(new Paragraph({ text: `${i + 1}. ${r}` })));
  }
  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safe(c.title)}.docx`);
}

async function exportProjectZip(c: ProjectContent) {
  // No JSZip dep; bundle into a single Markdown for now.
  const { jsPDF } = await import("jspdf");
  const md =
    `# ${c.title}\n\n${c.summary}\n\n## Stack\n${c.stack?.join(", ")}\n\n## Features\n${(c.features ?? []).map((f) => `- ${f}`).join("\n")}\n\n## Database Schema\n\`\`\`sql\n${c.schema}\n\`\`\`\n\n## README\n${c.readme}\n\n## Deployment\n${c.deployment}\n\n## Files\n${(c.files ?? []).map((f) => `\n### \`${f.path}\`\n\`\`\`${f.language ?? ""}\n${f.content}\n\`\`\`\n`).join("\n")}\n`;
  // Save markdown
  const { saveAs } = await import("file-saver");
  saveAs(new Blob([md], { type: "text/markdown" }), `${safe(c.title)}.md`);
  // Also offer PDF
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const lines = pdf.splitTextToSize(md, 520);
  let y = 40;
  pdf.setFontSize(10);
  for (const ln of lines) {
    if (y > 780) { pdf.addPage(); y = 40; }
    pdf.text(ln, 40, y);
    y += 14;
  }
  pdf.save(`${safe(c.title)}.pdf`);
}

function safe(s: string) {
  return s.replace(/[^a-z0-9-_ ]/gi, "").trim().slice(0, 60) || "intelliverse-doc";
}
