import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ImageIcon,
  Mic2,
  Music2,
  Presentation,
  GraduationCap,
  FolderGit2,
  Globe,
  AppWindow,
  VideoIcon,
  Sparkles,
  Lock,
  Code2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProviderStatuses } from "@/lib/providers.functions";

export const Route = createFileRoute("/_app/studio/")({
  component: StudioHub,
});

type Tool = {
  to: string;
  title: string;
  desc: string;
  icon: any;
  tint: string;
  requiresProviderId?: string;
  requiresVideo?: boolean;
};

const TOOLS: Tool[] = [
  { to: "/studio/vibe", title: "Vibe Coding", desc: "Build full apps, sites & APIs from chat. Project memory + live preview.", icon: Sparkles, tint: "from-indigo-500/30 to-fuchsia-500/10" },
  { to: "/studio/code", title: "Code Studio", desc: "Edit, debug & explain ANY language code. Chat in any language.", icon: Code2, tint: "from-indigo-500/30 to-blue-500/10" },
  { to: "/studio/image", title: "Image Generator", desc: "Text → PNG. Logos, posters, photos.", icon: ImageIcon, tint: "from-pink-500/30 to-rose-500/10" },
  { to: "/studio/audio", title: "Voice Generator", desc: "Text-to-speech → real MP3 narration.", icon: Mic2, tint: "from-amber-500/30 to-orange-500/10" },
  { to: "/studio/music", title: "Music Generator", desc: "Text → MP3 tracks (requires Suno).", icon: Music2, tint: "from-rose-500/30 to-red-500/10", requiresProviderId: "suno" },
  { to: "/studio/video", title: "Video Generator", desc: "Text → MP4 (Runway / Luma / Pika).", icon: VideoIcon, tint: "from-fuchsia-500/30 to-pink-500/10", requiresVideo: true },
  { to: "/studio/docs?kind=website", title: "Website Builder", desc: "Prompt → full source ZIP + live preview.", icon: Globe, tint: "from-cyan-500/30 to-sky-500/10" },
  { to: "/studio/docs?kind=app", title: "App Builder", desc: "Prompt → full source ZIP + live preview.", icon: AppWindow, tint: "from-fuchsia-500/30 to-pink-500/10" },
  { to: "/studio/docs?kind=project", title: "Project Generator", desc: "Multi-file scaffold ZIP for any stack.", icon: FolderGit2, tint: "from-blue-500/30 to-cyan-500/10" },
  { to: "/studio/docs?kind=presentation", title: "Presentation", desc: "Real downloadable PPTX decks.", icon: Presentation, tint: "from-violet-500/30 to-purple-500/10" },
  { to: "/studio/docs?kind=assignment", title: "Assignment", desc: "Reports & essays — DOCX + PDF.", icon: GraduationCap, tint: "from-emerald-500/30 to-teal-500/10" },
];

function StudioHub() {
  const list = useServerFn(listProviderStatuses);
  const { data: providers } = useQuery({
    queryKey: ["providerStatusesHub"],
    queryFn: () => list(),
  });
  const videoReady = providers?.some((p) => p.category === "video" && p.enabled && p.configured);
  const isReady = (t: Tool) => {
    if (t.requiresVideo) return !!videoReady;
    if (t.requiresProviderId) {
      const p = providers?.find((x) => x.id === t.requiresProviderId);
      return !!(p?.enabled && p.configured);
    }
    return true;
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI Creation Studio</h1>
            <p className="text-sm text-muted-foreground">Every tool returns a real downloadable file.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => {
            const ready = isReady(t);
            return (
              <Link key={t.title} to={t.to}>
                <div
                  className={`group relative h-full rounded-2xl border border-border/60 bg-gradient-to-br ${t.tint} p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-background/80 backdrop-blur">
                      <t.icon className="h-5 w-5" />
                    </div>
                    {!ready && <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <h3 className="text-base font-semibold">{t.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                  {!ready && (
                    <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Setup required — open to configure
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
