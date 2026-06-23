import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { VideoIcon, ChevronLeft, Lock, Settings2 } from "lucide-react";
import { listProviderStatuses } from "@/lib/providers.functions";

export const Route = createFileRoute("/_app/studio/video")({
  head: () => ({ meta: [{ title: "AI Video Generator — IntelliVerse" }] }),
  component: VideoPage,
});

function VideoPage() {
  const list = useServerFn(listProviderStatuses);
  const { data: providers, isLoading } = useQuery({
    queryKey: ["providerStatusesVideo"],
    queryFn: () => list(),
  });
  const videoProviders = providers?.filter((p) => p.category === "video") ?? [];
  const ready = videoProviders.find((p) => p.enabled && p.configured);

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
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <h2 className="text-base font-semibold">{ready.name} configured</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Provider key detected. The video adapter will produce a real MP4 saved to your Library.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
