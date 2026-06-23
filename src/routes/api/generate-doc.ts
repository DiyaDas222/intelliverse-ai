import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type DocKind = "presentation" | "assignment" | "project" | "website" | "app";

const SYSTEMS: Record<DocKind, string> = {
  presentation: `You generate professional slide decks.
Output STRICT JSON ONLY (no markdown fences, no commentary) matching:
{"title": string, "subtitle": string, "slides": [{"title": string, "bullets": string[], "notes": string}]}
Aim for 6-10 slides. Each slide 3-6 concise bullets. Notes <= 2 sentences.`,
  assignment: `You generate well-structured academic assignments.
Output STRICT JSON ONLY matching:
{"title": string, "subject": string, "sections": [{"heading": string, "body": string}], "references": string[]}
4-7 sections. Body paragraphs (no bullets). References as plain text citations.`,
  project: `You generate complete software project scaffolds.
Output STRICT JSON ONLY matching:
{"title": string, "summary": string, "stack": string[], "features": string[], "schema": string, "files": [{"path": string, "language": string, "content": string}], "readme": string, "deployment": string}
Include 6-12 starter files with real working code (not stubs). schema is SQL DDL. readme is markdown.`,
  website: `You generate complete static/single-page WEBSITE source code (HTML/CSS/JS, or a small React/Vite project).
Output STRICT JSON ONLY matching:
{"title": string, "summary": string, "stack": string[], "features": string[], "schema": string, "files": [{"path": string, "language": string, "content": string}], "readme": string, "deployment": string}
Files MUST include a runnable index.html (and styles.css / app.js as needed) OR a Vite React project (package.json, vite.config.ts, src/...). Include 6-15 files of REAL working code. schema can be "" if not needed.`,
  app: `You generate a complete APPLICATION source code scaffold (web app, mobile-friendly React app, or Node CLI).
Output STRICT JSON ONLY matching:
{"title": string, "summary": string, "stack": string[], "features": string[], "schema": string, "files": [{"path": string, "language": string, "content": string}], "readme": string, "deployment": string}
Include package.json with scripts, real source files (8-16), components, routes, state, and basic styling. schema is SQL DDL if a backend is implied, otherwise "".`,
};

function stripJson(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}

export const Route = createFileRoute("/api/generate-doc")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { kind, prompt, model } = (await request.json().catch(() => ({}))) as {
          kind?: DocKind;
          prompt?: string;
          model?: string;
        };
        if (!kind || !prompt || !SYSTEMS[kind]) {
          return new Response("kind and prompt required", { status: 400 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        try {
          const { text } = await generateText({
            model: gateway(model || "google/gemini-2.5-flash"),
            system: SYSTEMS[kind],
            prompt,
          });
          const parsed = JSON.parse(stripJson(text));
          return Response.json({ content: parsed });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI request failed";
          if (msg.includes("429")) return new Response("Rate limit", { status: 429 });
          if (msg.includes("402")) return new Response("Credits exhausted", { status: 402 });
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
