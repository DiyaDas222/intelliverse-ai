import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { VideoIcon, ChevronLeft, Lock, Settings2, Loader2, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import { listProviderStatuses } from "@/lib/providers.functions";
import { supabase } from "@/integrations/supabase/client";
import { GenerationProgress } from "@/components/generation-progress";

export const Route = createFileRoute("/_app/studio/video")({
  head: () => ({ meta: [{ title: "AI Video Generator — IntelliVerse" }] }),
  component: VideoPage,
});

function VideoPage() {
  const list = useServerFn(listProviderStatuses);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const { data: providers, isLoading } = useQuery({
    queryKey: ["providerStatusesVideo"],
    queryFn: () => list(),
  });
  const videoProviders = providers?.filter((p) => p.category === "video") ?? [];
  const ready = videoProviders.find((p) => p.enabled && p.configured);

  useEffect(() => {
    const brief = sessionStorage.getItem("iv:wizard-brief:video");
    if (brief) {
      setPrompt(brief);
      sessionStorage.removeItem("iv:wizard-brief:video");
      toast.success("Brief loaded from chat — review and click Generate");
    }
  }, []);

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setVideoUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch("/api/generate-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ prompt, title }),
      });
      const raw = await r.text();
      let data: { url?: string; message?: string } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
      if (!r.ok) throw new Error(data.message || raw || "Video generation failed");
      setVideoUrl(data.url ?? null);
      toast.success("Video generated and saved to Library");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Video generation failed");
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
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-pink-500/10">
            <VideoIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">AI Video Generator</h1>
            <p className="text-xs text-muted-foreground">Generate real MP4 clips from a text prompt.</p>
          </div>
        </div>

        {isLoading ? null : !ready ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Video provider not configured</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Video generation requires a paid third-party provider. Add an API key for any of the providers below
              in Admin → Providers, then refresh to start generating MP4 clips.
            </p>
            <ul className="mt-4 space-y-2">
              {videoProviders.map((p) => (
                <li key={p.id} className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    <code className="font-mono text-[11px] text-muted-foreground">{p.env_vars.join(", ")}</code>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              to="/providers"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <Settings2 className="h-3 w-3" />
              Open Admin → Providers
            </Link>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-5">
            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
              Provider ready: <span className="font-medium text-foreground">{ready.name}</span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Describe the video</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="A cinematic drone shot over a futuristic coastal city at sunrise, slow camera movement"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Futuristic city clip"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={generate}
              disabled={!prompt.trim() || busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Generating MP4…" : "Generate video file"}
            </button>

            <GenerationProgress kind="video" active={busy} />



            {videoUrl && (
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <video controls src={videoUrl} className="aspect-video w-full rounded-md bg-background" />
                <a href={videoUrl} download className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Download className="h-3 w-3" /> Download MP4
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
