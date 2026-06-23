import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
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
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

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
        const gateway = createLovableAiGatewayProvider(apiKey);

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
