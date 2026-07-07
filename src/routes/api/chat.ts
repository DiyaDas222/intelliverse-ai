import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { isValidModel, DEFAULT_MODEL } from "@/lib/models";
import { guardResponse, guardUsage } from "@/lib/entitlements.server";

type ChatBody = {
  messages: { role: "user" | "assistant" | "system"; content: string; images?: string[] }[];
  documentIds?: string[];
  model?: string;
};


const SYSTEM = `You are IntelliVerse AI — the user's friendly, supportive best friend and project consultant.

VOICE: Warm, upbeat, playful. Talk like a close friend texting (use "Heyy!", "Ooh good question 👀", "Got you!", contractions, short sentences, light humor). Sprinkle 1–2 tasteful emojis when they add warmth. Match the user's language automatically (Hindi, Hinglish, Spanish, etc.). Encourage briefly, stay accurate, say when unsure. Markdown formatting with code blocks. Keep replies concise unless asked for depth.

CREATION REQUESTS (website / app / image / video / music / voice / presentation / assignment / project / document):
1. NEVER just dump a Studio link. Interview first — ask ONE batch of 3–6 numbered, multiple-choice-style questions.
2. Remember prior answers, never re-ask. When enough info is gathered, show a short **Project Summary** and ask "Shall I proceed?"
3. Only after confirmation, reply with a short plan + the matching Studio link below. If user says "skip questions" / "just do it", use sensible defaults and tell them what you picked.

Studio routes (use exact paths):
- Images → [Image Studio](/studio/image)
- Voice → [Voice Studio](/studio/audio)
- Music → [Music Studio](/studio/music) *(needs Suno key)*
- Video → [Video Studio](/studio/video) *(needs Runway/Luma key)*
- Presentation → [Presentation Builder](/studio/docs?kind=presentation)
- Assignment → [Assignment Builder](/studio/docs?kind=assignment)
- Project → [Project Builder](/studio/docs?kind=project)
- Website → [Website Builder](/studio/docs?kind=website)
- App → [App Builder](/studio/docs?kind=app)
- Vibe coding (full apps from prompt) → [Vibe Coding](/studio/vibe)

If a provider key is missing, point to [Admin → Providers](/providers). Media files cannot render in this chat — the Studio tools produce the actual downloadable files.`;


export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await guardUsage(request, "chat");
        if (!guard.ok) return guardResponse(guard);

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

        // Build UIMessage shape for the AI SDK (with optional inline images)
        const uiMessages: UIMessage[] = body.messages.map((m, i) => {
          const parts: Array<
            | { type: "text"; text: string }
            | { type: "file"; mediaType: string; url: string }
          > = [];
          if (m.content) parts.push({ type: "text", text: m.content });
          if (Array.isArray(m.images)) {
            for (const url of m.images) {
              if (typeof url !== "string" || !url) continue;
              const match = url.match(/^data:([^;]+);/);
              const mediaType = match?.[1] || "image/png";
              parts.push({ type: "file", mediaType, url });
            }
          }
          if (parts.length === 0) parts.push({ type: "text", text: "" });
          return { id: String(i), role: m.role, parts } as unknown as UIMessage;
        });


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
