import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/share/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = params.token;
        if (!token) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: share, error } = await supabaseAdmin
          .from("asset_shares")
          .select("id, asset_id, expires_at, max_views, view_count, allow_download")
          .eq("token", token)
          .maybeSingle();
        if (error || !share) return new Response("Link not found", { status: 404 });
        if (new Date(share.expires_at).getTime() < Date.now())
          return new Response("Link expired", { status: 410 });
        if (share.max_views != null && share.view_count >= share.max_views)
          return new Response("Link view limit reached", { status: 410 });

        const { data: asset } = await supabaseAdmin
          .from("generated_assets")
          .select("id, kind, title, prompt, storage_path, mime_type, size_bytes, metadata, created_at")
          .eq("id", share.asset_id)
          .maybeSingle();
        if (!asset) return new Response("Asset not found", { status: 404 });

        await supabaseAdmin
          .from("asset_shares")
          .update({ view_count: share.view_count + 1 })
          .eq("id", share.id);

        let fileUrl: string | null = null;
        if (asset.storage_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("generations")
            .createSignedUrl(asset.storage_path, 3600);
          fileUrl = signed?.signedUrl ?? null;
        }

        const wantsRedirect = new URL(request.url).searchParams.get("download") === "1";
        if (wantsRedirect && fileUrl && share.allow_download) {
          return Response.redirect(fileUrl, 302);
        }

        return Response.json({
          asset,
          fileUrl: share.allow_download ? fileUrl : null,
          expiresAt: share.expires_at,
          allowDownload: share.allow_download,
        });
      },
    },
  },
});
