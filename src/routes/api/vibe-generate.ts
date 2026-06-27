import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { requireUser } from "@/lib/require-auth.server";

type VibeFile = { path: string; content: string };
type Stack = Record<string, unknown>;
type Message = { role: "user" | "assistant"; content: string };

type Body = {
  prompt: string;
  kind?: string;
  stack?: Stack;
  files?: VibeFile[];
  messages?: Message[];
  mode?: "scaffold" | "modify";
};

const SYSTEM = `You are Vibe Coder, an elite full-stack AI engineer that builds complete software projects from natural language.

You ALWAYS respond with a SINGLE JSON object (no markdown fences, no prose outside the JSON) of this exact shape:

{
  "summary": "1-3 sentence friendly summary of what you built or changed",
  "questions": ["optional clarifying question 1", "..."],
  "entry_file": "path/to/main/preview/file (e.g. index.html) or null",
  "files": [ { "path": "relative/path.ext", "content": "FULL file contents" } ],
  "notes": "optional setup / run instructions in markdown"
}

Rules:
- "files" must include the COMPLETE updated contents of every file you create or change. Never truncate, never use "...".
- When MODIFYING an existing project, only return files you ADD or CHANGE. Unchanged files should be omitted.
- Prefer a runnable, production-quality structure. Include README.md and package.json when relevant.
- For websites that can be previewed in a browser, ALWAYS provide a self-contained "index.html" (inline its own CSS/JS or reference sibling files) and set "entry_file" to "index.html".
- For React/Next/Node/Flutter/etc projects, produce real source files (src/..., app/..., lib/...) with working code.
- Use the user's chosen tech stack. If a field is missing, pick a sensible default and mention it in "summary".
- Ask clarifying questions in "questions" ONLY when the request is genuinely ambiguous; otherwise return an empty array and just build.
- Keep file contents UTF-8 text. No binary assets.`;

export const Route = createFileRoute("/api/vibe-generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = getGatewayApiKey();
        if (!key) {
          return new Response(JSON.stringify({ error: "AI gateway is not configured" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const body = (await request.json().catch(() => ({}))) as Body;
        const prompt = (body.prompt || "").slice(0, 8000);
        if (!prompt.trim()) {
          return new Response(JSON.stringify({ error: "Missing prompt" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const fileList = (body.files ?? [])
          .slice(0, 60)
          .map((f) => `--- ${f.path} ---\n${(f.content || "").slice(0, 8000)}`)
          .join("\n\n");

        const history = (body.messages ?? [])
          .slice(-10)
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n");

        const mode = body.mode ?? (body.files?.length ? "modify" : "scaffold");

        const user =
          `MODE: ${mode}\n` +
          `KIND: ${body.kind ?? "website"}\n` +
          `STACK: ${JSON.stringify(body.stack ?? {})}\n\n` +
          (history ? `CONVERSATION SO FAR:\n${history}\n\n` : "") +
          (fileList ? `CURRENT PROJECT FILES:\n${fileList}\n\n` : "") +
          `USER REQUEST:\n${prompt}\n\n` +
          `Return ONLY the JSON object as specified.`;

        const gateway = createGatewayProvider(key);
        let raw = "";
        try {
          const result = await generateText({
            model: gateway("google/gemini-2.5-flash"),
            system: SYSTEM,
            prompt: user,
          });
          raw = result.text;
        } catch (e: any) {
          return new Response(
            JSON.stringify({ error: e?.message || "Generation failed" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        const parsed = extractJson(raw);
        if (!parsed) {
          return new Response(
            JSON.stringify({ error: "The AI returned a malformed response. Please try again.", raw }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }

        // Normalize
        const safe = {
          summary: String(parsed.summary ?? ""),
          questions: Array.isArray(parsed.questions) ? parsed.questions.map(String).slice(0, 8) : [],
          entry_file: typeof parsed.entry_file === "string" ? parsed.entry_file : null,
          files: Array.isArray(parsed.files)
            ? parsed.files
                .filter((f: any) => f && typeof f.path === "string" && typeof f.content === "string")
                .map((f: any) => ({ path: f.path, content: f.content }))
            : [],
          notes: typeof parsed.notes === "string" ? parsed.notes : "",
        };

        return new Response(JSON.stringify(safe), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});

function extractJson(text: string): any | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}
