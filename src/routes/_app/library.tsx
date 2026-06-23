import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ImageIcon,
  Mic2,
  Presentation,
  GraduationCap,
  FolderGit2,
  FileText,
  Search,
  Trash2,
  Download,
  Loader2,
  LibraryBig,
  Share2,
  Copy,
  X,
} from "lucide-react";
import { listAssets, deleteAsset, signAssetUrl, type AssetKind, type AssetRow } from "@/lib/assets.functions";
import { createShareLink, listAssetShares, revokeShareLink, type ShareRow } from "@/lib/shares.functions";

export const Route = createFileRoute("/_app/library")({
  head: () => ({ meta: [{ title: "Library — IntelliVerse" }] }),
  component: LibraryPage,
});

const FILTERS: { id: AssetKind | "all"; label: string; icon: any }[] = [
  { id: "all", label: "All", icon: LibraryBig },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "audio", label: "Audio", icon: Mic2 },
  { id: "presentation", label: "Decks", icon: Presentation },
  { id: "assignment", label: "Assignments", icon: GraduationCap },
  { id: "project", label: "Projects", icon: FolderGit2 },
  { id: "document", label: "Docs", icon: FileText },
];

function LibraryPage() {
  const [filter, setFilter] = useState<AssetKind | "all">("all");
  const [search, setSearch] = useState("");
  const [shareAsset, setShareAsset] = useState<AssetRow | null>(null);
  const qc = useQueryClient();
  const listFn = useServerFn(listAssets);
  const delFn = useServerFn(deleteAsset);
  const signFn = useServerFn(signAssetUrl);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", filter, search],
    queryFn: () => listFn({ data: { kind: filter, search } }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(a: AssetRow) {
    if (!a.storage_path) {
      toast.info("This item has no downloadable file");
      return;
    }
    try {
      const { url } = await signFn({ data: { id: a.id } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <LibraryBig className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Library</h1>
            <p className="text-xs text-muted-foreground">Everything you've created with IntelliVerse</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                filter === f.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <f.icon className="h-3 w-3" />
              {f.label}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-16 text-center">
            <LibraryBig className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">No items yet</p>
            <Link
              to="/studio"
              className="mt-3 inline-block rounded-md bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Open Creation Studio
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((a) => (
              <AssetCard
                key={a.id}
                asset={a}
                onDelete={() => delMut.mutate(a.id)}
                onDownload={() => download(a)}
                onShare={() => setShareAsset(a)}
              />
            ))}
          </div>
        )}
      </div>

      {shareAsset && <ShareDialog asset={shareAsset} onClose={() => setShareAsset(null)} />}
    </div>
  );
}

function AssetCard({
  asset,
  onDelete,
  onDownload,
  onShare,
}: {
  asset: AssetRow;
  onDelete: () => void;
  onDownload: () => void;
  onShare: () => void;
}) {
  const Icon = FILTERS.find((f) => f.id === asset.kind)?.icon ?? FileText;
  return (
    <div className="group rounded-xl border border-border/60 bg-card/40 p-3 transition-all hover:border-primary/40">
      <div className="mb-2 flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{asset.title}</p>
          <p className="text-[10px] capitalize text-muted-foreground">
            {asset.kind} · {new Date(asset.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onShare}
            className="rounded p-1 text-muted-foreground hover:text-primary"
            title="Share"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          {asset.storage_path && (
            <button
              onClick={onDownload}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => confirm("Delete this item?") && onDelete()}
            className="rounded p-1 text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

const EXPIRY_PRESETS = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
];

function ShareDialog({ asset, onClose }: { asset: AssetRow; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createShareLink);
  const listFn = useServerFn(listAssetShares);
  const revokeFn = useServerFn(revokeShareLink);
  const [hours, setHours] = useState(24);
  const [allowDownload, setAllowDownload] = useState(true);

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["shares", asset.id],
    queryFn: () => listFn({ data: { assetId: asset.id } }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({ data: { assetId: asset.id, expiresInHours: hours, allowDownload } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares", asset.id] });
      toast.success("Share link created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shares", asset.id] });
      toast.success("Revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function urlFor(s: ShareRow) {
    return `${window.location.origin}/s/${s.token}`;
  }

  async function copy(s: ShareRow) {
    await navigator.clipboard.writeText(urlFor(s));
    toast.success("Link copied");
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Share "{asset.title}"</h2>
            <p className="text-xs text-muted-foreground">Anyone with the link can view until it expires.</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Link expires in
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  key={p.hours}
                  onClick={() => setHours(p.hours)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    hours === p.hours
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allowDownload}
              onChange={(e) => setAllowDownload(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Allow download
          </label>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
            Create share link
          </button>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Active links</p>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : shares.length === 0 ? (
            <p className="text-xs text-muted-foreground">No share links yet.</p>
          ) : (
            <ul className="space-y-2">
              {shares.map((s) => {
                const expired = new Date(s.expires_at).getTime() < Date.now();
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2 text-xs"
                  >
                    <input
                      readOnly
                      value={urlFor(s)}
                      className="flex-1 truncate rounded bg-transparent px-1 outline-none"
                    />
                    <span className={`shrink-0 text-[10px] ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                      {expired ? "Expired" : `expires ${new Date(s.expires_at).toLocaleDateString()}`}
                    </span>
                    <button
                      onClick={() => copy(s)}
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => revokeMut.mutate(s.id)}
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                      title="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
