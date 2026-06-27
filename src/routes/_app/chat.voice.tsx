import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authedFetch } from "@/lib/authed-fetch";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { DEFAULT_MODEL, isValidModel } from "@/lib/models";

export const Route = createFileRoute("/_app/chat/voice")({
  component: VoiceModePage,
  head: () => ({
    meta: [{ title: "Voice mode · IntelliVerse" }],
  }),
});

type Turn = { role: "user" | "assistant"; content: string };

type Phase = "idle" | "listening" | "thinking" | "speaking";

function VoiceModePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const recorder = useVoiceRecorder();
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
      stoppedRef.current = true;
    };
  }, []);

  const speakAndPlay = async (text: string) => {
    setPhase("speaking");
    const res = await authedFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: "alloy" }),
    });
    if (!res.ok || !res.body) {
      toast.error("Voice playback failed");
      setPhase("idle");
      return;
    }
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    let playhead = 0;
    let pending = new Uint8Array(0);

    const play = (incoming: Uint8Array) => {
      const bytes = new Uint8Array(pending.length + incoming.length);
      bytes.set(pending);
      bytes.set(incoming, pending.length);
      const usable = bytes.length - (bytes.length % 2);
      pending = bytes.slice(usable);
      if (usable === 0) return;
      const samples = new Int16Array(bytes.buffer, 0, usable / 2);
      const floats = Float32Array.from(samples, (s) => s / 32768);
      const buffer = ctx.createBuffer(1, floats.length, 24000);
      buffer.copyToChannel(floats, 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      if (playhead === 0) playhead = ctx.currentTime + 0.05;
      else playhead = Math.max(playhead, ctx.currentTime);
      source.start(playhead);
      playhead += buffer.duration;
    };

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let bufStr = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bufStr += value;
      const lines = bufStr.split("\n");
      bufStr = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const j = JSON.parse(line.slice(5).trim());
          if (j.type === "speech.audio.delta" && j.audio) {
            const bin = atob(j.audio);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            play(arr);
          }
        } catch { /* skip */ }
      }
    }
    // Wait roughly until audio finishes before re-arming.
    const wait = Math.max(0, (playhead - ctx.currentTime) * 1000);
    setTimeout(() => {
      if (!stoppedRef.current) setPhase("idle");
    }, wait + 200);
  };

  const handleTurn = async () => {
    if (phase !== "idle") return;
    if (recorder.state === "idle") {
      setTranscript("");
      setReply("");
      setPhase("listening");
      await recorder.start();
      return;
    }
    if (recorder.state === "recording") {
      const blob = await recorder.stop();
      if (!blob) {
        setPhase("idle");
        return;
      }
      setPhase("thinking");
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const t = await authedFetch("/api/transcribe", { method: "POST", body: form });
      const tj = (await t.json().catch(() => ({}))) as { text?: string };
      const userText = (tj.text ?? "").trim();
      if (!userText) {
        toast.error("Didn't catch that");
        setPhase("idle");
        return;
      }
      setTranscript(userText);
      const turns: Turn[] = [...history, { role: "user", content: userText }];
      setHistory(turns);

      const stored = typeof window !== "undefined" ? localStorage.getItem("iv:model") : null;
      const model = isValidModel(stored) ? stored : DEFAULT_MODEL;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await authedFetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are in a hands-free voice conversation. Keep replies under 3 sentences. Plain spoken text only — no markdown, lists, or code.",
            },
            ...turns,
          ],
          model,
        }),
      });
      if (!res.ok || !res.body) {
        toast.error("AI failed");
        setPhase("idle");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setReply(acc);
      }
      setHistory([...turns, { role: "assistant", content: acc }]);
      await speakAndPlay(acc);
    }
  };

  // Status / orb color
  const orbClass =
    phase === "listening"
      ? "from-emerald-400 to-emerald-600 animate-pulse"
      : phase === "thinking"
        ? "from-amber-400 to-amber-600"
        : phase === "speaking"
          ? "from-primary to-accent animate-pulse"
          : "from-primary/70 to-accent/70";

  const statusLabel =
    phase === "listening"
      ? "Listening…"
      : phase === "thinking"
        ? "Thinking…"
        : phase === "speaking"
          ? "Speaking…"
          : "Tap the mic to talk";

  if (!user) {
    return <div className="grid h-full place-items-center text-sm text-muted-foreground">Sign in to use voice mode.</div>;
  }

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-background to-background/50">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="text-sm font-medium">Voice mode</div>
        <button
          onClick={() => {
            stoppedRef.current = true;
            recorder.cancel();
            navigate({ to: "/chat" as never });
          }}
          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          title="End"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
        <div className={`h-44 w-44 rounded-full bg-gradient-to-br ${orbClass} shadow-2xl shadow-primary/20`}>
          {phase === "listening" && (
            <div className="flex h-full items-end justify-center gap-1 px-6 pb-12">
              {recorder.levels.map((v, i) => (
                <span
                  key={i}
                  style={{ height: `${Math.max(6, v * 60)}px` }}
                  className="w-[3px] rounded-full bg-white/80 transition-all"
                />
              ))}
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-muted-foreground">{statusLabel}</p>

        <div className="min-h-[80px] w-full max-w-md text-center">
          {transcript && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">You: </span>
              {transcript}
            </p>
          )}
          {reply && (
            <p className="mt-3 text-sm">
              <span className="font-medium">AI: </span>
              {reply}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-6 py-8 pb-[max(env(safe-area-inset-bottom),24px)]">
        <button
          onClick={handleTurn}
          disabled={phase === "thinking" || phase === "speaking"}
          className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 disabled:opacity-50"
          title={recorder.state === "recording" ? "Stop & send" : "Talk"}
        >
          {phase === "thinking" ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : recorder.state === "recording" ? (
            <Square className="h-7 w-7 fill-current" />
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </button>
      </div>
    </div>
  );
}
