import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { ImageIcon, Loader2, Save, Sparkles, ChevronLeft } from "lucide-react";
import { saveImageAsset } from "@/lib/assets.functions";

export const Route = createFileRoute("/_app/studio/image")({
  head: () => ({ meta: [{ title: "AI Image Generator — IntelliVerse" }] }),
  component: ImagePage,
});

const PRESETS = [
  { label: "Photo", suffix: ", photorealistic, 35mm, soft natural light" },
  { label: "Logo", suffix: ", vector logo, minimal, flat, on white background" },
  { label: "Poster", suffix: ", bold typography, modern poster design" },
  { label: "Anime", suffix: ", anime style, vibrant colors, detailed background" },
  { label: "3D", suffix: ", 3D render, octane, soft shadows, studio lighting" },
  { label: "Mockup", suffix: ", product mockup, studio backdrop, premium" },
];

function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<string>("Photo");
  const [size, setSize] = useState("1024x1024");
  const [src, setSrc] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [b64, setB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const saveFn = useServerFn(saveImageAsset);

  // Prefill from chat wizard if a brief was queued
  useEffect(() => {
    const brief = sessionStorage.getItem("iv:wizard-brief:image");
    if (brief) {
      setPrompt(brief);
      sessionStorage.removeItem("iv:wizard-brief:image");
      toast.success("Brief loaded from chat — review and click Generate");
    }
  }, []);

  const saveMut = useMutation({
    mutationFn: (data: { prompt: string; b64: string }) => saveFn({ data }),
    onSuccess: () => {
      toast.success("Saved to Library");
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setSrc(null);
    setIsFinal(false);
    setB64(null);
    const suffix = PRESETS.find((p) => p.label === preset)?.suffix ?? "";
    const fullPrompt = prompt + suffix;
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, size }),
      });
      if (!res.ok || !res.body) {
        toast.error(`Generation failed: ${res.status}`);
        setBusy(false);
        return;
      }
      const parser = createParser({
        onEvent(event) {
          if (
            event.event !== "image_generation.partial_image" &&
            event.event !== "image_generation.completed"
          )
            return;
          let payload: { b64_json: string };
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }
          const isDone = event.event === "image_generation.completed";
          flushSync(() => {
            setSrc(`data:image/png;base64,${payload.b64_json}`);
            if (isDone) {
              setIsFinal(true);
              setB64(payload.b64_json);
            }
          });
        },
      });
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(value);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/studio" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3 w-3" /> Studio
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pink-500/30 to-rose-500/10">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">AI Image Generator</h1>
            <p className="text-xs text-muted-foreground">IntelliVerse AI · GPT-Image-2</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Controls */}
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card/40 p-5">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="A serene mountain lake at sunrise with mist…"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Style preset</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setPreset(p.label)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      preset === p.label
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Size</label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="1024x1024">Square 1024×1024</option>
                <option value="1024x1536">Portrait 1024×1536</option>
                <option value="1536x1024">Landscape 1536×1024</option>
              </select>
            </div>
            <button
              onClick={generate}
              disabled={busy || !prompt.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <div className="aspect-square w-full overflow-hidden rounded-xl border border-border/40 bg-muted/30">
              {src ? (
                <img
                  src={src}
                  alt="Generated"
                  className={`h-full w-full object-cover transition-[filter] ${isFinal ? "" : "blur-2xl"}`}
                />
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">
                  Your image will appear here
                </div>
              )}
            </div>
            {isFinal && b64 && (
              <div className="mt-3 flex gap-2">
                <a
                  href={src!}
                  download="intelliverse-image.png"
                  className="flex-1 rounded-md border border-border px-3 py-2 text-center text-xs hover:bg-sidebar-accent"
                >
                  Download
                </a>
                <button
                  onClick={() => saveMut.mutate({ prompt, b64 })}
                  disabled={saveMut.isPending}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save to Library
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
