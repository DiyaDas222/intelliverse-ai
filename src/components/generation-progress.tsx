import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Kind = "image" | "voice" | "music" | "video" | "audio";

const STEPS: Record<Kind, { label: string; at: number }[]> = {
  image: [
    { label: "Interpreting prompt…", at: 0 },
    { label: "Composing scene…", at: 3 },
    { label: "Rendering pixels…", at: 8 },
    { label: "Saving to your Library…", at: 18 },
  ],
  voice: [
    { label: "Preparing voice model…", at: 0 },
    { label: "Synthesizing speech…", at: 2 },
    { label: "Encoding MP3…", at: 8 },
    { label: "Saving to your Library…", at: 14 },
  ],
  audio: [
    { label: "Preparing voice model…", at: 0 },
    { label: "Synthesizing speech…", at: 2 },
    { label: "Encoding MP3…", at: 8 },
    { label: "Saving to your Library…", at: 14 },
  ],
  music: [
    { label: "Drafting music plan (mood, key, BPM)…", at: 0 },
    { label: "Synthesizing instruments…", at: 4 },
    { label: "Mixing & encoding WAV…", at: 12 },
    { label: "Saving to your Library…", at: 22 },
  ],
  video: [
    { label: "Queueing video job…", at: 0 },
    { label: "Generating frames (this can take a minute)…", at: 4 },
    { label: "Rendering MP4…", at: 30 },
    { label: "Saving to your Library…", at: 70 },
  ],
};

// Asymptotic progress — never reaches 100 until the caller hides the indicator.
function progressFor(seconds: number, expected: number) {
  const ratio = 1 - Math.exp(-seconds / expected);
  return Math.min(0.96, ratio);
}

const EXPECTED: Record<Kind, number> = {
  image: 12,
  voice: 10,
  audio: 10,
  music: 18,
  video: 60,
};

export function GenerationProgress({ kind, active }: { kind: Kind; active: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active, kind]);

  if (!active) return null;

  const steps = STEPS[kind];
  const current = [...steps].reverse().find((s) => elapsed >= s.at) ?? steps[0];
  const pct = Math.round(progressFor(elapsed, EXPECTED[kind]) * 100);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 items-center gap-2 text-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          <span className="truncate">{current.label}</span>
        </div>
        <span className="shrink-0 font-mono text-muted-foreground">
          {pct}% · {mm}:{ss}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
