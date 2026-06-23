import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/generate-image-file")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { prompt?: string; title?: string; size?: string };
        if (!body.prompt?.trim()) return new Response("prompt required", { status: 400 });

        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u, error: ue } = await supabase.auth.getUser();
        if (ue || !u.user) return new Response("Unauthorized", { status: 401 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-image-2",
            prompt: body.prompt,
            size: body.size ?? "1024x1024",
            quality: "low",
            stream: false,
          }),
        });
        if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status });
        const payload = (await upstream.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
        const item = payload.data?.[0];
        const imageBytes = item?.b64_json
          ? Uint8Array.from(atob(item.b64_json), (c) => c.charCodeAt(0))
          : item?.url
            ? new Uint8Array(await (await fetch(item.url)).arrayBuffer())
            : null;
        if (!imageBytes) return new Response("Image provider returned no image", { status: 502 });

        const path = `${u.user.id}/images/${crypto.randomUUID()}.png`;
        const { error: upErr } = await supabase.storage.from("generations").upload(path, imageBytes, { contentType: "image/png", upsert: false });
        if (upErr) return new Response(upErr.message, { status: 500 });

        const title = body.title?.trim() || body.prompt.slice(0, 60) || "Generated image";
        const { data: row, error: insErr } = await supabase
          .from("generated_assets")
          .insert({
            user_id: u.user.id,
            kind: "image",
            title,
            prompt: body.prompt,
            storage_path: path,
            mime_type: "image/png",
            size_bytes: imageBytes.byteLength,
          })
          .select()
          .single();
        if (insErr) return new Response(insErr.message, { status: 500 });

        const { data: signed } = await supabase.storage.from("generations").createSignedUrl(path, 3600);
        return Response.json({ asset: row, url: signed?.signedUrl });
      },
    },
  },
});