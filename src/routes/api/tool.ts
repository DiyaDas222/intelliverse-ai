import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
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
        if (!apiKey) {
          return json({ error: "AI_SERVICE_UNAVAILABLE", message: "AI tools are not configured yet.", fallback: true }, 200);
        }

        let body: ToolBody;
        try {
          body = (await request.json()) as ToolBody;
        } catch {
          return json({ error: "INVALID_JSON", message: "Invalid request body." }, 400);
        }
        if (!body.prompt || !body.system) {
          return json({ error: "MISSING_INPUT", message: "Tool input is incomplete." }, 400);
        }

        const modelId = isValidModel(body.model) ? body.model : DEFAULT_MODEL;
        const gateway = createGatewayProvider(apiKey);

        try {
          const result = await generateText({
            model: gateway(modelId),
            system: body.system,
            prompt: body.prompt,
          });
          return json({ text: result.text }, 200);
        } catch (err) {
          console.error("Tool AI error", err);
          const msg = err instanceof Error ? err.message : "AI request failed";
          if (msg.includes("429")) {
            return json({ error: "RATE_LIMITED", message: "Rate limit reached. Please retry shortly." }, 429);
          }
          if (msg.includes("402")) {
            return json({ error: "CREDITS_EXHAUSTED", message: "AI credits exhausted." }, 402);
          }
          if (msg.includes("400")) {
            return json({ error: "BAD_AI_REQUEST", message: msg }, 400);
          }
          return json({ error: "AI_SERVICE_FAILED", message: "AI tools are temporarily unavailable.", fallback: true }, 200);
        }
      },
    },
  },
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
