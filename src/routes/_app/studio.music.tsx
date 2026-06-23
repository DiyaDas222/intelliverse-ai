import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Music2, ChevronLeft, Lock, Settings2 } from "lucide-react";
import { listProviderStatuses } from "@/lib/providers.functions";

export const Route = createFileRoute("/_app/studio/music")({
  head: () => ({ meta: [{ title: "AI Music Generator — IntelliVerse" }] }),
  component: MusicPage,
});

function MusicPage() {
  const list = useServerFn(listProviderStatuses);
  const { data: providers, isLoading } = useQuery({
    queryKey: ["providerStatusesMusic"],
    queryFn: () => list(),
  });
  // Suno is the music-capable provider in our registry.
  const music = providers?.find((p) => p.id === "suno");
  const configured = !!music?.configured && music.enabled;

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

        {isLoading ? null : !configured ? (
          <SetupCard
            title="Music provider not configured"
            provider="Suno"
            envVar="SUNO_API_KEY"
            description="Music generation requires a paid third-party provider. Add a Suno API key in Admin → Providers, then refresh this page to start generating MP3 tracks."
          />
        ) : (
          <ComingSoonCard
            title="Suno integration ready"
            description="Provider key is set. The Suno generation adapter will produce a real MP3 saved to your Library. This UI ships next — the backend slot is wired."
          />
        )}
      </div>
    </div>
  );
}

export function SetupCard({
  title,
  provider,
  envVar,
  description,
}: {
  title: string;
  provider: string;
  envVar: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-6">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
        <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span className="font-medium">{provider}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Required secret</span><code className="font-mono text-[11px]">{envVar}</code></div>
      </div>
      <Link
        to="/providers"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-primary-foreground"
      >
        <Settings2 className="h-3 w-3" />
        Open Admin → Providers
      </Link>
    </div>
  );
}

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
