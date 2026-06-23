import { createFileRoute } from "@tanstack/react-router";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";
import { generateText } from "ai";
import { DEFAULT_MODEL } from "@/lib/models";

type Body = {
  documentId: string;
  kind: "summary" | "keypoints" | "search" | "ocr";
  query?: string;
};

const PROMPTS = {
  summary:
    "Write a clear, well-structured summary of the following document. Use markdown with a short overview paragraph followed by section bullets. Keep it concise but complete.",
  keypoints:
    "Extract the most important key points from the following document. Return a markdown bulleted list of 5–15 crisp, specific takeaways. No preamble.",
} as const;

export const Route = createFileRoute("/api/doc-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = getGatewayApiKey();
        if (!apiKey) return new Response("AI gateway is not configured", { status: 500 });
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

        let body: Body;
        try { body = (await request.json()) as Body; } catch { return new Response("Bad JSON", { status: 400 }); }
        if (!body.documentId || !body.kind) return new Response("Missing fields", { status: 400 });

        const { createClient } = await import("@supabase/supabase-js");
        const supa = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: doc, error } = await supa
          .from("documents")
          .select("id,user_id,filename,mime_type,storage_path,extracted_text")
          .eq("id", body.documentId)
          .single();
        if (error || !doc) return new Response("Document not found", { status: 404 });

        const gateway = createGatewayProvider(apiKey);
        const model = gateway(DEFAULT_MODEL);

        try {
          // OCR: run multimodal vision on the stored image
          if (body.kind === "ocr") {
            const { data: signed } = await supa.storage
              .from("documents")
              .createSignedUrl(doc.storage_path, 120);
            if (!signed?.signedUrl) return new Response("Cannot read file", { status: 500 });
            const imgRes = await fetch(signed.signedUrl);
            const buf = new Uint8Array(await imgRes.arrayBuffer());
            let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
            const b64 = btoa(bin);
            const dataUrl = `data:${doc.mime_type || "image/png"};base64,${b64}`;
            const { text } = await generateText({
              model,
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: "Extract ALL text visible in this image. Return only the raw extracted text, preserving line breaks. If no readable text, reply with an empty string." },
                  { type: "image", image: dataUrl },
                ],
              }],
            });
            await supa.from("documents").update({ extracted_text: text }).eq("id", doc.id);
            return Response.json({ text });
          }

          const context = (doc.extracted_text ?? "").slice(0, 80_000);
          if (!context.trim()) return new Response("No extractable text on this document", { status: 400 });

          let prompt: string;
          if (body.kind === "search") {
            if (!body.query?.trim()) return new Response("Query required", { status: 400 });
            prompt = `You are searching within a document. Given the user's query, return the most relevant excerpts and a concise answer. Use markdown with: a short Answer, then a "Matching excerpts" section with up to 5 quoted snippets (each with a brief surrounding context).\n\nQuery: ${body.query}\n\n---\nDOCUMENT: ${doc.filename}\n${context}\n---`;
          } else {
            prompt = `${PROMPTS[body.kind]}\n\n---\nDOCUMENT: ${doc.filename}\n${context}\n---`;
          }

          const { text } = await generateText({ model, prompt });
          await supa.from("document_analyses").insert({
            user_id: doc.user_id,
            document_id: doc.id,
            kind: body.kind,
            query: body.query ?? null,
            result: text,
          });
          return Response.json({ text });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI request failed";
          if (msg.includes("429")) return new Response("Rate limit", { status: 429 });
          if (msg.includes("402")) return new Response("Credits exhausted", { status: 402 });
          console.error("doc-action error", err);
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
