import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { isValidModel, DEFAULT_MODEL } from "@/lib/models";

type ChatBody = {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  documentIds?: string[];
  model?: string;
};

const SYSTEM = `You are IntelliVerse AI, a warm, sharp, and helpful assistant.
- Respond in clean Markdown.
- Use code blocks with language hints for code.
- Be concise but thorough. Prefer bullet points and short paragraphs.
- If unsure, say so and propose how to find out.

MEDIA & FILE GENERATION ROUTING — CRITICAL:
This chat surface is for text/conversation only. It cannot generate media files inline.
When a user asks to generate any of the following, DO NOT produce a text description,
script, outline, or placeholder. Instead, reply with ONE short sentence plus a Markdown
link to the correct Studio tool. Use these exact routes:

- Images (PNG/JPG)         → [Open Image Studio](/studio/image)
- Voice / speech (MP3)     → [Open Voice Studio](/studio/audio)
- Music / songs (MP3)      → [Open Music Studio](/studio/music)  *(requires Suno API key)*
- Video / clips (MP4)      → [Open Video Studio](/studio/video)  *(requires Runway/Luma API key)*
- Presentations (PPTX)     → [Open Presentation Builder](/studio/docs?kind=presentation)
- Assignments (DOCX/PDF)   → [Open Assignment Builder](/studio/docs?kind=assignment)
- Projects (ZIP)           → [Open Project Builder](/studio/docs?kind=project)
- Websites (ZIP)           → [Open Website Builder](/studio/docs?kind=website)
- Apps (ZIP)               → [Open App Builder](/studio/docs?kind=app)

If a tool requires a provider key that is not yet set, also tell the user to add it in
[Admin → Providers](/providers). Never claim a media file was created here.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = getGatewayApiKey();
        if (!apiKey) return new Response("AI gateway is not configured", { status: 500 });

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

        const gateway = createGatewayProvider(apiKey);
        const modelId = isValidModel(body.model) ? body.model : DEFAULT_MODEL;
        const model = gateway(modelId);

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
