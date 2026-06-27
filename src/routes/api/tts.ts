import { createFileRoute } from "@tanstack/react-router";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { requireUser } from "@/lib/require-auth.server";
import { consumeCreditsOrReject, COST } from "@/lib/credits.server";

type Body = { text?: string; voice?: string };

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authed = await requireUser(request);
        if (authed instanceof Response) return authed;

        const blocked = await consumeCreditsOrReject(authed.userId, COST.tts);
        if (blocked) return blocked;
        const apiKey = getGatewayApiKey();
        if (!apiKey) return new Response("AI gateway is not configured", { status: 500 });

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const text = (body.text ?? "").trim();
        if (!text) return new Response("text is required", { status: 400 });

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: text.slice(0, 4000),
              voice: body.voice || "alloy",
              stream_format: "sse",
              response_format: "pcm",
            }),
          });
          if (!res.ok || !res.body) {
            const t = await res.text().catch(() => "");
            return new Response(t || "TTS failed", { status: res.status });
          }
          return new Response(res.body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "TTS failed";
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
