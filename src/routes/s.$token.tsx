import { createFileRoute, ErrorComponent, notFound } from "@tanstack/react-router";
import { Download, FileText, ImageIcon, Mic2, Presentation, GraduationCap, FolderGit2 } from "lucide-react";

type SharePayload = {
  asset: {
    id: string;
    kind: string;
    title: string;
    prompt: string | null;
    storage_path: string | null;
    mime_type: string | null;
    metadata: Record<string, any>;
    created_at: string;
  };
  fileUrl: string | null;
  expiresAt: string;
  allowDownload: boolean;
};

export const Route = createFileRoute("/s/$token")({
  head: ({ loaderData }) => {
    const d = loaderData as SharePayload | undefined;
    return {
      meta: [
        { title: d ? `${d.asset.title} — Shared on IntelliVerse` : "Shared link" },
        { name: "description", content: "A file shared via IntelliVerse AI" },
      ],
    };
  },
  loader: async ({ params }) => {
    const res = await fetch(`/api/public/share/${params.token}`);
    if (res.status === 404) throw notFound();
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as SharePayload;
  },
  errorComponent: ({ error }) => <ErrorComponent error={error} />,
  notFoundComponent: () => (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="text-center">
        <p className="text-2xl font-semibold">Link not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This share link is invalid, expired, or has been revoked.
        </p>
      </div>
    </div>
  ),
  component: SharePage,
});

const ICONS: Record<string, any> = {
  image: ImageIcon,
  audio: Mic2,
  presentation: Presentation,
  assignment: GraduationCap,
  project: FolderGit2,
  document: FileText,
};

function SharePage() {
  const { asset, fileUrl, expiresAt, allowDownload } = Route.useLoaderData() as SharePayload;
  const Icon = ICONS[asset.kind] ?? FileText;
  const expires = new Date(expiresAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <span className="text-[10px] font-bold">IV</span>
          </div>
          Shared via IntelliVerse AI
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
          <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            {asset.kind === "image" && fileUrl ? (
              <img src={fileUrl} alt={asset.title} className="h-full w-full object-contain" />
            ) : (
              <Icon className="h-16 w-16 text-muted-foreground" />
            )}
          </div>

          <div className="space-y-4 p-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{asset.kind}</p>
              <h1 className="mt-1 text-xl font-semibold">{asset.title}</h1>
              {asset.prompt && (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{asset.prompt}</p>
              )}
            </div>

            {asset.kind === "audio" && fileUrl && (
              <audio controls src={fileUrl} className="w-full" />
            )}

            <div className="flex items-center justify-between border-t border-border/60 pt-4 text-xs text-muted-foreground">
              <span>Expires {expires.toLocaleString()}</span>
              {allowDownload && fileUrl ? (
                <a
                  href={fileUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              ) : !allowDownload ? (
                <span>Download disabled</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
