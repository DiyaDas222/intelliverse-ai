import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { requireUser } from "@/lib/require-auth.server";

type Action = "edit" | "debug" | "explain" | "complete" | "chat";

const ACTIONS: Record<Action, string> = {
  edit: `You are a senior polyglot programmer. The user will give you source code and an instruction.
Rewrite the code to satisfy the instruction. Preserve style and structure where possible.
Return TWO clearly-labelled sections in markdown:
1) An "### Updated code" section containing ONE fenced code block with the COMPLETE updated file (no ellipses).
2) An "### What changed" section with a short bulleted summary.`,
  debug: `You are an expert debugger. The user provides source code (and optionally an error message).
- Identify the root cause precisely (line numbers when possible).
- Provide a corrected version of the file in a single fenced code block under "### Fixed code".
- Under "### Explanation", briefly explain the bug and the fix.`,
  explain: `You are a patient teacher. Explain the user's code clearly.
- Start with a one-paragraph high-level summary.
- Then a "### Walkthrough" with bullet points covering each important section.
- Then "### Potential improvements" with 2-4 concrete suggestions.`,
  complete: `You are a code completion engine. Continue the user's code naturally.
Return ONLY one fenced code block containing the FULL file (existing + new code), no commentary.`,
  chat: `You are an expert software engineer pair-programmer.
Answer questions about the user's code and project. Use markdown, fenced code blocks for code.`,
};

function detectLangHint(text: string): string {
  // Lightweight script/locale hint — the model handles real detection.
  if (/[\u0900-\u097F]/.test(text)) return "Hindi (Devanagari)";
  if (/[\u0600-\u06FF]/.test(text)) return "Arabic";
  if (/[\u4E00-\u9FFF]/.test(text)) return "Chinese";
  if (/[\u3040-\u30FF]/.test(text)) return "Japanese";
  if (/[\uAC00-\uD7AF]/.test(text)) return "Korean";
  if (/[\u0400-\u04FF]/.test(text)) return "Russian";
  return "auto";
}

export const Route = createFileRoute("/api/code-assist")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = getGatewayApiKey();
        if (!key) return new Response("AI gateway is not configured", { status: 500 });

        const body = (await request.json().catch(() => ({}))) as {
          action?: Action;
          language?: string;
          code?: string;
          instruction?: string;
          error?: string;
          history?: { role: "user" | "assistant"; content: string }[];
          model?: string;
        };

        const action: Action = body.action ?? "chat";
        if (!ACTIONS[action]) return new Response("invalid action", { status: 400 });

        const language = (body.language || "plaintext").slice(0, 40);
        const code = (body.code || "").slice(0, 60000);
        const instruction = (body.instruction || "").slice(0, 4000);
        const errorText = (body.error || "").slice(0, 4000);
        const langHint = detectLangHint(instruction || errorText || "");

        const system =
          ACTIONS[action] +
          `\n\nLANGUAGE POLICY: The user's source code language tag is "${language}". ` +
          `Detect the natural language of the user's instructions automatically (hint: ${langHint}). ` +
          `Reply in the SAME natural language the user wrote in. Default to English only if the user wrote in English. ` +
          `Always keep code identifiers, keywords and fenced blocks in their original programming language.`;

        const userParts: string[] = [];
        if (code.trim()) {
          userParts.push(`Source file (language: ${language}):\n\n\`\`\`${language}\n${code}\n\`\`\``);
        }
        if (errorText.trim()) {
          userParts.push(`Error / stack trace:\n\n\`\`\`\n${errorText}\n\`\`\``);
        }
        if (instruction.trim()) {
          userParts.push(`Instruction:\n${instruction}`);
        } else if (action !== "chat") {
          userParts.push(`Instruction:\nPerform the "${action}" action on the code above.`);
        }

        const messages: { role: "user" | "assistant"; content: string }[] = [];
        if (Array.isArray(body.history)) {
          for (const m of body.history.slice(-20)) {
            if ((m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
              messages.push({ role: m.role, content: m.content.slice(0, 8000) });
            }
          }
        }
        messages.push({ role: "user", content: userParts.join("\n\n") || instruction || "Help me." });

        const gateway = createGatewayProvider(key);
        const result = streamText({
          model: gateway(body.model || "google/gemini-2.5-flash"),
          system,
          messages,
        });

        return result.toTextStreamResponse();
      },
    },
  },
});
