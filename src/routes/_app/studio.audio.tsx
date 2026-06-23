import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic2, Loader2, ChevronLeft, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GenerationProgress } from "@/components/generation-progress";

export const Route = createFileRoute("/_app/studio/audio")({
  head: () => ({ meta: [{ title: "AI Audio Studio — IntelliVerse" }] }),
  component: AudioPage,
});

const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];

function AudioPage() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [title, setTitle] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const qc = useQueryClient();

  const gen = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/generate-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ text, voice, title }),
      });
      if (!r.ok) throw new Error(await r.text());
      return (await r.json()) as { url: string };
    },
    onSuccess: (res) => {
      setAudioUrl(res.url);
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Audio generated and saved to Library");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/studio" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3 w-3" /> Studio
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/10">
            <Mic2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Audio & Voice Studio</h1>
            <p className="text-xs text-muted-foreground">Text-to-speech, narration, podcast intros</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Text to speak</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              maxLength={8000}
              placeholder="Welcome to IntelliVerse, your all-in-one AI workspace…"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">{text.length} / 8000 characters</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Voice</label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm capitalize"
              >
                {VOICES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Podcast intro v1"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => gen.mutate()}
            disabled={!text.trim() || gen.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {gen.isPending ? "Generating…" : "Generate audio"}
          </button>

          {audioUrl && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <audio controls src={audioUrl} className="w-full" />
              <a
                href={audioUrl}
                download
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Download MP3
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
