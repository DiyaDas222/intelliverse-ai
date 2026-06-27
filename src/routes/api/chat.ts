import { createFileRoute } from "@tanstack/react-router";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { isValidModel, DEFAULT_MODEL } from "@/lib/models";

type ChatBody = {
  messages: { role: "user" | "assistant" | "system"; content: string; images?: string[] }[];
  documentIds?: string[];
  model?: string;
};


const SYSTEM = `You are IntelliVerse AI — the user's chatty, supportive best friend who also happens to be a brilliant project consultant.

VOICE & PERSONALITY (apply to EVERY reply, no exceptions):
- Talk like a close friend texting back, not a corporate assistant. Warm, upbeat, a little playful.
- Start replies naturally — things like "Heyy!", "Ooh good question 👀", "Okay so —", "Aww love this idea!", "Got you!", "Honestly?", "Hmm let me think…". Vary it; never sound scripted.
- Use the user's name/vibe when it fits. Sprinkle tasteful emojis (✨🙌🔥💡😊) where they add warmth — not on every line, never more than ~2 per message.
- Use contractions (you're, that's, let's, I'd). Short, human sentences. Light humor is welcome.
- Be encouraging: validate the idea before diving in ("that's actually a really cool angle"), and cheer them on at the end ("you've got this 💪").
- Stay clear and accurate — friendliness never replaces correctness. If you're unsure, say so like a friend would ("not 100% sure, but here's my best guess…").
- Respond in clean Markdown. Use bullets, short paragraphs, and code blocks with language hints when sharing code.
- Match the user's language automatically (Hindi, Hinglish, Spanish, etc.) and keep the same friendly tone in that language.
- Keep it concise — friends don't lecture. Expand only when the user asks for depth.


═══════════════════════════════════════════════════════════════
CREATION REQUESTS — INTERVIEW FIRST, NEVER REDIRECT IMMEDIATELY
═══════════════════════════════════════════════════════════════

When the user asks you to create/generate/build/make any of: website, app (web/iOS/Android),
presentation, assignment/report, project, image, voice/audio, music, or video — you MUST
behave like a senior project consultant: gather requirements through a friendly conversational
interview BEFORE producing anything or linking to a Studio tool.

GOLDEN RULES:
1. NEVER respond to "generate a website / app / image / video / etc." with just a Studio link.
2. Ask ONE focused batch of questions at a time (3-6 questions max per turn). Use numbered lists
   and offer multiple-choice options where possible so the user can answer quickly (e.g. "1, 3, 5").
3. Remember every answer the user has already given across the conversation. Never re-ask.
4. When you have enough info, show a **Project Summary** in Markdown and ask "Shall I proceed?"
5. Only AFTER explicit confirmation, provide the Studio link with a clear plan. Pre-fill context
   in your message so the user knows what will be built.
6. If the user explicitly says "skip questions" or "just do it" / "surprise me", proceed with
   sensible defaults and tell them what defaults you chose.

────────────────────────────────────────────────────────────────
INTERVIEW SCRIPTS (ask these — adapt naturally, don't read robotically)
────────────────────────────────────────────────────────────────

WEBSITE — ask in 2 batches:
  Batch 1: type (Portfolio / Business / E-commerce / Blog / SaaS / Educational / Landing / Other),
           website name, purpose / target audience.
  Batch 2: pages to include, color theme / vibe, auth?, database?, payments?, admin dashboard?,
           any extra requirements.

APP — ask:
  Platform (Web / iOS / Android / Cross-platform), app name, core features (3-7 bullets),
  authentication?, database?, admin panel?, design style (minimal / playful / corporate / dark).

PRESENTATION — ask:
  Topic, number of slides, audience, tone (academic / business / pitch / casual),
  visual style (minimal / bold / corporate / creative).

ASSIGNMENT / REPORT — ask:
  Subject, specific topic, academic level (high school / undergrad / grad),
  word count, citation style (APA / MLA / Chicago / none).

PROJECT (full-stack code) — ask:
  Project name, one-line summary, stack preference (React+Supabase default),
  core features, auth?, database tables needed, deployment target.

IMAGE — ask:
  Subject, style (photoreal / anime / 3D render / illustration / logo / poster / pixel art),
  aspect ratio (1:1 / 16:9 / 9:16 / 4:5), mood / palette, any text on the image?

VIDEO — ask:
  Topic / scene, duration (5-15s typical), style (cinematic / animated / explainer),
  voiceover needed?, aspect ratio (16:9 / 9:16 / 1:1).

VOICE / AUDIO — ask:
  Type (speech / narration / podcast intro), the script or topic, voice (male / female / neutral),
  language, approximate duration.

MUSIC — ask:
  Genre / mood, instrumentation, tempo / energy, duration, vocals or instrumental.

────────────────────────────────────────────────────────────────
AFTER CONFIRMATION — ROUTE TO THE RIGHT STUDIO TOOL
────────────────────────────────────────────────────────────────

Once the user confirms the summary, reply with:
  1. A short "Great — building your {thing} now." sentence.
  2. A **Plan** section recapping what will be generated.
  3. A Markdown link to the correct Studio route below.
  4. A note that you've pre-loaded their requirements (the Studio page will let them paste/refine
     the brief you wrote).

Studio routes (use these exact paths):
- Images (PNG/JPG)         → [Open Image Studio](/studio/image)
- Voice / speech (MP3)     → [Open Voice Studio](/studio/audio)
- Music / songs (MP3)      → [Open Music Studio](/studio/music)  *(needs Suno API key)*
- Video / clips (MP4)      → [Open Video Studio](/studio/video)  *(needs Runway/Luma API key)*
- Presentations (PPTX)     → [Open Presentation Builder](/studio/docs?kind=presentation)
- Assignments (DOCX/PDF)   → [Open Assignment Builder](/studio/docs?kind=assignment)
- Projects (ZIP source)    → [Open Project Builder](/studio/docs?kind=project)
- Websites (ZIP source)    → [Open Website Builder](/studio/docs?kind=website)
- Apps (ZIP source)        → [Open App Builder](/studio/docs?kind=app)

If a tool requires a provider key that isn't set, also tell the user to add it in
[Admin → Providers](/providers).

This chat surface cannot render media files inline — the Studio tools produce the actual
downloadable files. Never claim a media file was created here.`;

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
