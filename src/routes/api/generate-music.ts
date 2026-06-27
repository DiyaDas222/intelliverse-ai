import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createGatewayProvider } from "@/lib/ai-gateway.server";
import { getGatewayApiKey } from "@/lib/gateway-config.server";

type MusicPlan = {
  title?: string;
  bpm?: number;
  key?: string;
  mood?: string;
  seconds?: number;
  progression?: string[];
};

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export const Route = createFileRoute("/api/generate-music")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = getGatewayApiKey();
        if (!apiKey) return new Response("AI gateway is not configured", { status: 500 });

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { prompt?: string; title?: string };
        if (!body.prompt?.trim()) return new Response("prompt required", { status: 400 });

        const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u, error: ue } = await supabase.auth.getUser();
        if (ue || !u.user) return new Response("Unauthorized", { status: 401 });

        const { consumeCreditsOrReject, COST } = await import("@/lib/credits.server");
        const blocked = await consumeCreditsOrReject(u.user.id, COST.music);
        if (blocked) return blocked;

        const plan = await createMusicPlan(apiKey, body.prompt);
        const title = body.title?.trim() || plan.title?.trim() || body.prompt.slice(0, 60) || "Generated music";
        const wav = synthesizeWav(plan, body.prompt);
        const path = `${u.user.id}/music/${crypto.randomUUID()}.wav`;

        const { error: upErr } = await supabase.storage
          .from("generations")
          .upload(path, wav, { contentType: "audio/wav", upsert: false });
        if (upErr) return new Response(upErr.message, { status: 500 });

        const { data: row, error: insErr } = await supabase
          .from("generated_assets")
          .insert({
            user_id: u.user.id,
            kind: "audio",
            title,
            prompt: body.prompt,
            storage_path: path,
            mime_type: "audio/wav",
            size_bytes: wav.byteLength,
            metadata: { category: "music", plan },
          })
          .select()
          .single();
        if (insErr) return new Response(insErr.message, { status: 500 });

        const { data: signed } = await supabase.storage.from("generations").createSignedUrl(path, 3600);
        return Response.json({ asset: row, url: signed?.signedUrl, plan });
      },
    },
  },
});

async function createMusicPlan(key: string, prompt: string): Promise<MusicPlan> {
  try {
    const gateway = createGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: "Return only compact JSON for a short instrumental music render. No markdown.",
      prompt: `Create a music plan for: ${prompt}\nSchema: {"title":"short title","bpm":80-150,"key":"C|D|E|F|G|A|B|C#|F#|Bb","mood":"one word","seconds":12-28,"progression":["I","V","vi","IV"]}`,
    });
    const json = result.text.replace(/```json|```/g, "").trim();
    return normalizePlan(JSON.parse(json));
  } catch {
    return normalizePlan({ title: prompt.slice(0, 48) });
  }
}

function normalizePlan(plan: MusicPlan): MusicPlan {
  const bpm = Math.min(150, Math.max(80, Number(plan.bpm) || 112));
  const seconds = Math.min(28, Math.max(12, Number(plan.seconds) || 18));
  const key = plan.key && NOTE_OFFSETS[plan.key] !== undefined ? plan.key : "C";
  const progression = Array.isArray(plan.progression) && plan.progression.length ? plan.progression.slice(0, 8) : ["I", "V", "vi", "IV"];
  return { ...plan, bpm, seconds, key, progression, mood: plan.mood || "bright" };
}

function synthesizeWav(plan: MusicPlan, prompt: string) {
  const sampleRate = 22_050;
  const seconds = plan.seconds ?? 18;
  const total = Math.floor(sampleRate * seconds);
  const pcm = new Int16Array(total);
  const root = 48 + (NOTE_OFFSETS[plan.key ?? "C"] ?? 0);
  const scale = prompt.toLowerCase().includes("sad") || prompt.toLowerCase().includes("dark") ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const beat = 60 / (plan.bpm ?? 112);
  const chordMap: Record<string, number[]> = { I: [0, 2, 4], ii: [1, 3, 5], iii: [2, 4, 6], IV: [3, 5, 0], V: [4, 6, 1], vi: [5, 0, 2] };
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(t / beat);
    const chordName = plan.progression?.[Math.floor(beatIndex / 4) % (plan.progression.length || 1)] ?? "I";
    const chord = chordMap[chordName] ?? chordMap.I;
    const env = 0.55 + 0.45 * Math.sin(Math.PI * ((t % beat) / beat));
    let sample = 0;
    for (const degree of chord) {
      const freq = midiToHz(root + scale[degree] - 12);
      sample += Math.sin(2 * Math.PI * freq * t) * 0.14;
      sample += Math.sin(2 * Math.PI * freq * 2 * t) * 0.045;
    }
    const leadDegree = scale[(beatIndex * 2 + Math.floor(hash(prompt) % 7)) % scale.length];
    const leadFreq = midiToHz(root + 12 + leadDegree);
    sample += Math.sin(2 * Math.PI * leadFreq * t) * 0.13 * env;
    const kick = Math.exp(-((t % beat) * 18)) * Math.sin(2 * Math.PI * 58 * t) * 0.35;
    const hat = ((hash(`${prompt}-${i >> 5}`) % 200) / 100 - 1) * 0.035 * (beatIndex % 2 ? 1 : 0.5);
    pcm[i] = Math.max(-32767, Math.min(32767, Math.floor((sample + kick + hat) * 32767)));
  }
  return encodeWav(pcm, sampleRate);
}

function midiToHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function encodeWav(samples: Int16Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  write(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, sample, true));
  return new Uint8Array(buffer);
}

function write(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}