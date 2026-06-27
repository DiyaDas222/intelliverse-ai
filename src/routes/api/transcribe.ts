import { createFileRoute } from "@tanstack/react-router";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { requireUser } from "@/lib/require-auth.server";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = getGatewayApiKey();
        if (!apiKey) return new Response("AI gateway is not configured", { status: 500 });

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return new Response("file is required", { status: 400 });
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        // Pick an extension that matches the recorded container.
        const type = (file.type || "").split(";")[0];
        const ext =
          type === "audio/webm"
            ? "webm"
            : type === "audio/mp4"
              ? "mp4"
              : type === "audio/mpeg"
                ? "mp3"
                : type === "audio/wav"
                  ? "wav"
                  : "webm";
        upstream.append("file", file, `recording.${ext}`);

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: upstream,
          });
          const text = await res.text();
          if (!res.ok) {
            return new Response(text || "Transcription failed", { status: res.status });
          }
          let parsed: { text?: string } = {};
          try {
            parsed = JSON.parse(text);
          } catch {
            return new Response(JSON.stringify({ text }), {
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ text: parsed.text ?? "" }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Transcription failed";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
