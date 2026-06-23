import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ProviderResult = { url: string; provider: string; metadata: Record<string, unknown> };

export const Route = createFileRoute("/api/generate-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { prompt?: string; title?: string; seconds?: number; ratio?: string };
        if (!body.prompt?.trim()) return new Response("prompt required", { status: 400 });

        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u, error: ue } = await supabase.auth.getUser();
        if (ue || !u.user) return new Response("Unauthorized", { status: 401 });

        if (!process.env.RUNWAY_API_KEY && !process.env.LUMA_API_KEY) {
          return Response.json(
            {
              message:
                "Video generation needs a configured video provider. Add RUNWAY_API_KEY or LUMA_API_KEY in Admin → Providers, then try again.",
              provider: "Runway or Luma AI",
            },
            { status: 412 },
          );
        }

        let generated: ProviderResult;
        try {
          generated = process.env.RUNWAY_API_KEY
            ? await generateRunwayVideo(body.prompt, body.seconds, body.ratio)
            : await generateLumaVideo(body.prompt, body.ratio);
        } catch (error) {
          return new Response(error instanceof Error ? error.message : "Video generation failed", { status: 502 });
        }

        const videoRes = await fetch(generated.url);
        if (!videoRes.ok) return new Response("Generated video could not be downloaded", { status: 502 });
        const bytes = new Uint8Array(await videoRes.arrayBuffer());
        const contentType = videoRes.headers.get("content-type")?.includes("mp4") ? "video/mp4" : "video/mp4";
        const path = `${u.user.id}/video/${crypto.randomUUID()}.mp4`;

        const { error: upErr } = await supabase.storage.from("generations").upload(path, bytes, { contentType, upsert: false });
        if (upErr) return new Response(upErr.message, { status: 500 });

        const title = body.title?.trim() || body.prompt.slice(0, 60) || "Generated video";
        const { data: row, error: insErr } = await supabase
          .from("generated_assets")
          .insert({
            user_id: u.user.id,
            kind: "video",
            title,
            prompt: body.prompt,
            storage_path: path,
            mime_type: contentType,
            size_bytes: bytes.byteLength,
            metadata: { provider: generated.provider, ...generated.metadata },
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

async function generateRunwayVideo(prompt: string, seconds = 5, ratio = "1280:720"): Promise<ProviderResult> {
  const created = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({ model: "gen4_turbo", promptText: prompt, ratio, duration: Math.min(10, Math.max(5, seconds)) }),
  });
  if (!created.ok) throw new Error(await created.text());
  const task = (await created.json()) as { id?: string };
  if (!task.id) throw new Error("Runway did not return a task id");

  for (let i = 0; i < 90; i++) {
    await delay(4000);
    const statusRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${task.id}`, {
      headers: { Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!statusRes.ok) throw new Error(await statusRes.text());
    const status = (await statusRes.json()) as { status?: string; output?: string[]; failure?: string };
    if (status.status === "FAILED") throw new Error(status.failure || "Runway generation failed");
    if (status.status === "SUCCEEDED" && status.output?.[0]) return { url: status.output[0], provider: "runway", metadata: { taskId: task.id } };
  }
  throw new Error("Runway generation timed out");
}

async function generateLumaVideo(prompt: string, ratio = "16:9"): Promise<ProviderResult> {
  const created = await fetch("https://api.lumalabs.ai/dream-machine/v1/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LUMA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: ratio === "1280:720" ? "16:9" : ratio, loop: false }),
  });
  if (!created.ok) throw new Error(await created.text());
  const generation = (await created.json()) as { id?: string };
  if (!generation.id) throw new Error("Luma did not return a generation id");

  for (let i = 0; i < 90; i++) {
    await delay(4000);
    const statusRes = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${generation.id}`, {
      headers: { Authorization: `Bearer ${process.env.LUMA_API_KEY}` },
    });
    if (!statusRes.ok) throw new Error(await statusRes.text());
    const status = (await statusRes.json()) as { state?: string; failure_reason?: string; assets?: { video?: string } };
    if (status.state === "failed") throw new Error(status.failure_reason || "Luma generation failed");
    if (status.state === "completed" && status.assets?.video) return { url: status.assets.video, provider: "luma", metadata: { generationId: generation.id } };
  }
  throw new Error("Luma generation timed out");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}