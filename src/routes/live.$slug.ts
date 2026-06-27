import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { buildPreviewDoc, type PreviewFile } from "@/lib/build-preview";

export const Route = createFileRoute("/live/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params.slug;
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
        );
        const { data, error } = await supabase
          .from("vibe_projects")
          .select("name,files,entry_file,deploy_status")
          .eq("slug", slug)
          .eq("deploy_status", "deployed")
          .maybeSingle();

        if (error || !data) {
          return new Response(notFoundHtml(slug), {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }

        const files = (data.files ?? []) as PreviewFile[];
        const doc = buildPreviewDoc(files, (data.entry_file as string | null) ?? null);
        if (!doc) {
          return new Response(notFoundHtml(slug, "This site has no entry HTML file."), {
            status: 404,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        return new Response(doc, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=30",
          },
        });
      },
    },
  },
});

function notFoundHtml(slug: string, reason = "This site isn't deployed yet.") {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Site not found</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{font-family:system-ui;background:#0b1020;color:#e5e7eb;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px}h1{font-size:22px;margin:0 0 8px}p{color:#9ca3af;margin:0 0 16px}code{background:#1f2937;padding:2px 6px;border-radius:6px}</style>
  </head><body><div><h1>Site not found</h1><p>${reason}</p><p>Slug: <code>${slug}</code></p></div></body></html>`;
}
