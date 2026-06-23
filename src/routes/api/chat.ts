import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatBody = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  documentIds?: string[];
};

const SYSTEM = `You are IntelliVerse AI, a warm, sharp, and helpful assistant.
- Respond in clean Markdown.
- Use code blocks with language hints for code.
- Be concise but thorough. Prefer bullet points and short paragraphs.
- If unsure, say so and propose how to find out.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }

        // Build doc context if requested. Require user auth via bearer token.
        let docContext = "";
        const authHeader = request.headers.get("authorization");
        if (body.documentIds?.length && authHeader?.startsWith("Bearer ")) {
          const { createClient } = await import("@supabase/supabase-js");
          const supa = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { global: { headers: { Authorization: authHeader } } },
          );
          const { data } = await supa
            .from("documents")
            .select("filename,extracted_text")
            .in("id", body.documentIds);
          if (data?.length) {
            docContext =
              "\n\nThe user has attached the following document(s) for context. Use them to answer:\n\n" +
              data
                .map(
                  (d) =>
                    `--- DOCUMENT: ${d.filename} ---\n${(d.extracted_text ?? "").slice(0, 60_000)}\n--- END ---`,
                )
                .join("\n\n");
          }
        }

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");

        // Build UIMessage shape for the AI SDK
        const uiMessages: UIMessage[] = body.messages.map((m, i) => ({
          id: String(i),
          role: m.role,
          parts: [{ type: "text", text: m.content }],
        })) as UIMessage[];

        try {
          const result = streamText({
            model,
            system: SYSTEM + docContext,
            messages: await convertToModelMessages(uiMessages),
          });

          // Plain text stream for our hand-rolled reader on the client
          return result.toTextStreamResponse();
        } catch (err) {
          console.error("AI error", err);
          const msg = err instanceof Error ? err.message : "AI request failed";
          if (msg.includes("429")) return new Response("Rate limit", { status: 429 });
          if (msg.includes("402")) return new Response("Credits exhausted", { status: 402 });
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
