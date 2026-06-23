import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music2, ChevronLeft, Loader2, Sparkles, Download, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { listProviderStatuses } from "@/lib/providers.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/studio/music")({
  head: () => ({ meta: [{ title: "AI Music Generator — IntelliVerse" }] }),
  component: MusicPage,
});

function MusicPage() {
  const list = useServerFn(listProviderStatuses);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { data: providers, isLoading } = useQuery({
    queryKey: ["providerStatusesMusic"],
    queryFn: () => list(),
  });
  const music = providers?.find((p) => p.id === "suno");

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setAudioUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/generate-music", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ prompt, title }),
      });
      const raw = await r.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!r.ok) throw new Error(data.message || raw || "Music generation failed");
      setAudioUrl(data.url);
      toast.success("Music generated and saved to Library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Music generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/studio" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3 w-3" /> Studio
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-500/30 to-rose-500/10">
            <Music2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">AI Music Generator</h1>
            <p className="text-xs text-muted-foreground">Generate real MP3 tracks from a text prompt.</p>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Describe the music</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Upbeat cinematic synthwave track for a product launch, energetic drums, bright lead melody"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Launch theme"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={generate}
            disabled={!prompt.trim() || busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Generating audio file…" : "Generate music file"}
          </button>

          {audioUrl && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <audio controls src={audioUrl} className="w-full" />
              <a href={audioUrl} download className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Download className="h-3 w-3" /> Download WAV
              </a>
            </div>
          )}
        </div>

        {!isLoading && music && !music.configured && (
          <div className="mt-4 rounded-xl border border-border/60 bg-card/30 p-4 text-xs text-muted-foreground">
            Native music export is enabled. For premium provider music, add <code>SUNO_API_KEY</code> in Admin → Providers.
            <Link to="/providers" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
              <Settings2 className="h-3 w-3" /> Open Providers
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
