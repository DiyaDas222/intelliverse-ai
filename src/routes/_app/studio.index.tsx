import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ImageIcon,
  Mic2,
  Presentation,
  GraduationCap,
  FolderGit2,
  VideoIcon,
  Sparkles,
  Lock,
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
  requires?: string; // provider id required
  external?: boolean; // requires non-native provider
};

const TOOLS: Tool[] = [
  { to: "/studio/image", title: "Image Generator", desc: "Text → image, logos, posters, mockups", icon: ImageIcon, tint: "from-pink-500/30 to-rose-500/10" },
  { to: "/studio/audio", title: "Audio & Voice", desc: "Text-to-speech, narration, voiceover", icon: Mic2, tint: "from-amber-500/30 to-orange-500/10" },
  { to: "/studio/docs", title: "Presentation", desc: "Generate decks, export PPTX/PDF", icon: Presentation, tint: "from-violet-500/30 to-purple-500/10" },
  { to: "/studio/docs", title: "Assignment", desc: "Reports, essays, case studies (DOCX/PDF)", icon: GraduationCap, tint: "from-emerald-500/30 to-teal-500/10" },
  { to: "/studio/docs", title: "Project Generator", desc: "Full project scaffold + README", icon: FolderGit2, tint: "from-blue-500/30 to-cyan-500/10" },
  { to: "/studio/video", title: "Video Generator", desc: "Text → video (requires Runway/Luma/Pika)", icon: VideoIcon, tint: "from-fuchsia-500/30 to-pink-500/10", external: true },
];

function StudioHub() {
  const list = useServerFn(listProviderStatuses);
  const { data: providers } = useQuery({
    queryKey: ["providerStatusesHub"],
    queryFn: () => list(),
  });
  const videoConfigured = providers?.some(
    (p) => p.category === "video" && p.enabled && p.configured,
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI Creation Studio</h1>
            <p className="text-sm text-muted-foreground">Generate images, audio, presentations, assignments, and more.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => {
            const locked = t.external && !videoConfigured;
            const Card = (
              <div
                className={`group relative h-full rounded-2xl border border-border/60 bg-gradient-to-br ${t.tint} p-5 transition-all ${
                  locked ? "opacity-60" : "hover:-translate-y-0.5 hover:border-primary/50"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-background/80 backdrop-blur">
                    <t.icon className="h-5 w-5" />
                  </div>
                  {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <h3 className="text-base font-semibold">{t.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                {locked && (
                  <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Add API key in Admin → Providers
                  </p>
                )}
              </div>
            );
            return locked ? (
              <div key={t.title}>{Card}</div>
            ) : (
              <Link key={t.title} to={t.to}>
                {Card}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
