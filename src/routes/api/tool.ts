import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { isValidModel, DEFAULT_MODEL } from "@/lib/models";

type ToolBody = {
  system?: string;
  prompt?: string;
  model?: string;
};

export const Route = createFileRoute("/api/tool")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = getGatewayApiKey();
        if (!apiKey) return new Response("AI gateway is not configured", { status: 500 });

        let body: ToolBody;
        try {
          body = (await request.json()) as ToolBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!body.prompt || !body.system) {
          return new Response("system and prompt required", { status: 400 });
        }

        const modelId = isValidModel(body.model) ? body.model : DEFAULT_MODEL;
        const gateway = createGatewayProvider(apiKey);

        try {
          const result = streamText({
            model: gateway(modelId),
            system: body.system,
            prompt: body.prompt,
          });
          return result.toTextStreamResponse();
        } catch (err) {
          console.error("Tool AI error", err);
          const msg = err instanceof Error ? err.message : "AI request failed";
          if (msg.includes("429")) return new Response("Rate limit", { status: 429 });
          if (msg.includes("402")) return new Response("Credits exhausted", { status: 402 });
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
