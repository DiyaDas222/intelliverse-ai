// Shared helper to assemble a single-file HTML doc from multiple project files
// by inlining sibling CSS and JS referenced from the entry HTML.

export type PreviewFile = { path: string; content: string };

export function buildPreviewDoc(files: PreviewFile[], entry: string | null): string | null {
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
