import { useMemo } from "react";
import { Eye } from "lucide-react";

type VibeFile = { path: string; content: string };

type Props = {
  files: VibeFile[];
  entry: string | null;
  stack: Record<string, unknown> | null | undefined;
  kind?: string | null;
};

type Mode = "html" | "react" | "vue" | "unsupported";

function detectMode(files: VibeFile[], stack: Props["stack"], kind?: string | null): Mode {
  const frontend = String((stack as any)?.frontend ?? "").toLowerCase();
  const hasHtml = files.some((f) => /(^|\/)index\.html$/i.test(f.path));
  if (frontend.includes("html") || (hasHtml && !frontend)) return "html";
  if (frontend.includes("react") && !frontend.includes("native")) return "react";
  if (frontend.includes("vue")) return "vue";
  if (hasHtml) return "html";
  // Auto-detect from files
  if (files.some((f) => /(^|\/)App\.(jsx?|tsx?)$/.test(f.path))) return "react";
  if (files.some((f) => /\.vue$/.test(f.path))) return "vue";
  if (kind && ["mobile", "api"].includes(kind)) return "unsupported";
  return "unsupported";
}

function buildHtmlDoc(files: VibeFile[], entry: string | null): string | null {
  const entryFile =
    (entry && files.find((f) => f.path === entry)) ||
    files.find((f) => /(^|\/)index\.html$/i.test(f.path));
  if (!entryFile) return null;
  let html = entryFile.content;
  const dir = entryFile.path.includes("/") ? entryFile.path.replace(/\/[^/]+$/, "/") : "";
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (m, href) => {
    const resolved = resolvePath(dir, href);
    const css = files.find((f) => f.path === resolved);
    return css ? `<style>\n${css.content}\n</style>` : m;
  });
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

export function LivePreview({ files, entry, stack, kind }: Props) {
  const mode = useMemo(() => detectMode(files, stack, kind), [files, stack, kind]);

  if (mode === "unsupported") {
    return (
      <div className="grid h-full place-items-center bg-white p-6 text-center text-xs text-muted-foreground">
        <div>
          <Eye className="mx-auto mb-2 h-5 w-5" />
          Live preview isn't available for this stack ({String((stack as any)?.frontend ?? kind ?? "unknown")}).
          <br />Download the ZIP and run it locally.
        </div>
      </div>
    );
  }

  if (mode === "html") {
    const doc = buildHtmlDoc(files, entry);
    if (!doc) {
      return (
        <div className="grid h-full place-items-center bg-white p-6 text-center text-xs text-muted-foreground">
          <div>
            <Eye className="mx-auto mb-2 h-5 w-5" />
            Live preview appears here once an <code>index.html</code> exists.
          </div>
        </div>
      );
    }
    return (
      <iframe
        title="preview"
        className="h-full w-full bg-white"
        sandbox="allow-scripts allow-forms allow-modals"
        srcDoc={doc}
      />
    );
  }

  return (
    <div className="grid h-full place-items-center bg-white p-6 text-center text-xs text-muted-foreground">
      <div>
        <Eye className="mx-auto mb-2 h-5 w-5" />
        Live preview is available for HTML projects. Download the ZIP to run this {mode} project locally.
      </div>
    </div>
  );
}
