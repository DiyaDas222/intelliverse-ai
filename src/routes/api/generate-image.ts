import { createFileRoute } from "@tanstack/react-router";
import { GATEWAY_BASE_URL, getGatewayApiKey, gatewayHeaders } from "@/lib/gateway-config.server";
import { requireUser } from "@/lib/require-auth.server";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt, size } = (await request.json().catch(() => ({}))) as {
          prompt?: string;
          size?: string;
        };
        if (!prompt) return new Response("prompt required", { status: 400 });

        const key = getGatewayApiKey();
        if (!key) return new Response("AI gateway is not configured", { status: 500 });

        const upstream = await fetch(
          `${GATEWAY_BASE_URL}/images/generations`,
          {
            method: "POST",
            headers: {
              ...gatewayHeaders(key),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "openai/gpt-image-2",
              prompt,
              size: size ?? "1024x1024",
              quality: "low",
              stream: true,
              partial_images: 1,
            }),
          },
        );
        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
