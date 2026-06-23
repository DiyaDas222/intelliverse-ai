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
} from "lucide-react";
import { listAssets, deleteAsset, signAssetUrl, type AssetKind, type AssetRow } from "@/lib/assets.functions";

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
              <AssetCard key={a.id} asset={a} onDelete={() => delMut.mutate(a.id)} onDownload={() => download(a)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  onDelete,
  onDownload,
}: {
  asset: AssetRow;
  onDelete: () => void;
  onDownload: () => void;
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
