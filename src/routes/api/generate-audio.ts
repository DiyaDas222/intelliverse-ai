import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/generate-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("AI gateway is not configured", { status: 500 });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as {
          text?: string;
          voice?: string;
          title?: string;
        };
        if (!body.text) return new Response("text required", { status: 400 });

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: u, error: ue } = await supabase.auth.getUser();
        if (ue || !u.user) return new Response("Unauthorized", { status: 401 });

        const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: body.text.slice(0, 8000),
            voice: body.voice ?? "alloy",
            response_format: "mp3",
          }),
        });
        if (!r.ok) {
          const t = await r.text();
          if (r.status === 429) return new Response("Rate limit", { status: 429 });
          if (r.status === 402) return new Response("Credits exhausted", { status: 402 });
          return new Response(t, { status: r.status });
        }
        const audio = new Uint8Array(await r.arrayBuffer());
        const path = `${u.user.id}/audio/${crypto.randomUUID()}.mp3`;

        const { error: upErr } = await supabase.storage
          .from("generations")
          .upload(path, audio, { contentType: "audio/mpeg" });
        if (upErr) return new Response(upErr.message, { status: 500 });

        const title = body.title?.trim() || body.text.slice(0, 60);
        const { data: row, error: insErr } = await supabase
          .from("generated_assets")
          .insert({
            user_id: u.user.id,
            kind: "audio",
            title,
            prompt: body.text,
            storage_path: path,
            mime_type: "audio/mpeg",
            size_bytes: audio.byteLength,
            metadata: { voice: body.voice ?? "alloy" },
          })
          .select()
          .single();
        if (insErr) return new Response(insErr.message, { status: 500 });

        const { data: signed } = await supabase.storage
          .from("generations")
          .createSignedUrl(path, 3600);

        return Response.json({ asset: row, url: signed?.signedUrl });
      },
    },
  },
});
