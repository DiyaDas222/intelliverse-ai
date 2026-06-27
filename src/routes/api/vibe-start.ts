import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { requireUser } from "@/lib/require-auth.server";
import { consumeCreditsOrReject, COST } from "@/lib/credits.server";

type VibeFile = { path: string; content: string };
type Body = {
  name?: string;
  description?: string;
  kind?: string;
  stack?: Record<string, unknown>;
};

const SYSTEM = `You are Vibe Coder, an elite product engineer. Build the user's requested website/app NOW, not a plan.

Return ONLY one JSON object:
{
  "summary": "short friendly summary",
  "entry_file": "index.html",
  "files": [{ "path": "index.html", "content": "FULL file contents" }],
  "notes": "optional"
}

Rules:
- Create real complete files. Never return placeholders, empty projects, TODO-only code, or prose instead of files.
- Always include a self-contained index.html that previews immediately in a browser.
- Inline CSS and JS in index.html for the first deploy so the live preview works instantly.
- If the user asks for a React/app/codebase, also include package.json, README.md, and src files, but still include index.html as the preview entry.
- Use sensible defaults when details are missing. Do not ask questions.
- Keep output valid JSON only.`;

export const Route = createFileRoute("/api/vibe-start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authed = await requireUser(request);
        if (authed instanceof Response) return authed;

        const body = (await request.json().catch(() => ({}))) as Body;
        const prompt = (body.description || "").trim().slice(0, 8000);
        if (!prompt) {
          return json({ error: "Tell me what to build first." }, 400);
        }

        const blocked = await consumeCreditsOrReject(authed.userId, COST.vibe);
        if (blocked) return blocked;

        const key = getGatewayApiKey();
        if (!key) return json({ error: "AI builder is not configured yet." }, 500);

        const gateway = createGatewayProvider(key);
        const userPrompt =
          `PROJECT NAME: ${body.name || "Untitled project"}\n` +
          `KIND: ${body.kind || "website"}\n` +
          `STACK: ${JSON.stringify(body.stack || {})}\n\n` +
          `USER REQUEST:\n${prompt}\n\nBuild, package, and deploy-ready preview now.`;

        let parsed: any | null = null;
        let raw = "";
        try {
          const result = await generateText({
            model: gateway("google/gemini-2.5-flash"),
            system: SYSTEM,
            prompt: userPrompt,
          });
          raw = result.text;
          parsed = extractJson(raw);
        } catch (e: any) {
          return json({ error: e?.message || "Builder failed to generate files." }, 500);
        }

        const files = normalizeFiles(parsed?.files);
        if (!parsed || files.length === 0) {
          return json({ error: "The builder did not return project files. Please try again.", raw }, 502);
        }

        const entryFile =
          typeof parsed.entry_file === "string" && parsed.entry_file.trim()
            ? parsed.entry_file.trim()
            : guessEntry(files);
        const name = (body.name || inferName(prompt)).trim().slice(0, 80) || "Vibe Project";
        const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date().toISOString();
        const messages = [
          { role: "user", content: prompt, at: now },
          {
            role: "assistant",
            content: String(parsed.summary || "Built and deployed your project."),
            at: now,
          },
        ];

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data, error } = await supabaseAdmin
          .from("vibe_projects")
          .insert({
            user_id: authed.userId,
            name,
            description: prompt.slice(0, 300),
            kind: body.kind || "website",
            stack: body.stack || {},
            files,
            messages,
            entry_file: entryFile,
            slug,
            deploy_status: "deployed",
            deployed_at: now,
            deploy_logs: [{ at: now, level: "info", message: "Generated files and deployed live preview." }],
            version: 1,
          } as never)
          .select("*")
          .single();

        if (error) return json({ error: error.message }, 500);
        return json({ project: data, liveUrl: `/live/${slug}` });
      },
    },
  },
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function extractJson(text: string): any | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizeFiles(files: unknown): VibeFile[] {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f: any) => f && typeof f.path === "string" && typeof f.content === "string" && f.content.trim())
    .map((f: any) => ({ path: f.path.replace(/^\/+/, ""), content: f.content }));
}

function guessEntry(files: VibeFile[]) {
  return files.find((f) => /(^|\/)index\.html$/i.test(f.path))?.path ?? files[0]?.path ?? "index.html";
}

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "site";
}

function inferName(prompt: string) {
  const quoted = prompt.match(/["“']([^"”']{3,60})["”']/)?.[1];
  if (quoted) return quoted;
  return prompt
    .replace(/\b(please|build|create|make|generate|develop|code|design|for me|a|an|the|website|web ?site|app|application|project)\b/gi, " ")
    .replace(/[^a-z0-9 ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || "Vibe Project";
}
