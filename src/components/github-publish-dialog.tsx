import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, Github, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  connectGithubPat, getGithubConnection, disconnectGithub,
  getProStatus, publishToGithub, listPublishHistory,
  type PublishFile,
} from "@/lib/github.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  files: PublishFile[];
  defaultRepoName: string;
  defaultDescription?: string;
  sourceKind: string;
  sourceId?: string;
};

export function GithubPublishDialog({
  open, onOpenChange, files, defaultRepoName, defaultDescription, sourceKind, sourceId,
}: Props) {
  const qc = useQueryClient();
  const connectFn = useServerFn(connectGithubPat);
  const getConnFn = useServerFn(getGithubConnection);
  const disconnectFn = useServerFn(disconnectGithub);
  const proFn = useServerFn(getProStatus);
  const publishFn = useServerFn(publishToGithub);
  const historyFn = useServerFn(listPublishHistory);

  const { data: conn, isLoading: connLoading } = useQuery({
    queryKey: ["githubConnection"],
    queryFn: () => getConnFn(),
    enabled: open,
  });
  const { data: pro } = useQuery({
    queryKey: ["proStatus"],
    queryFn: () => proFn(),
    enabled: open,
  });
  const { data: history } = useQuery({
    queryKey: ["publishHistory", sourceKind, sourceId],
    queryFn: () => historyFn({ data: { sourceKind, sourceId } }),
    enabled: open && !!conn,
  });

  const isPro = !!pro?.isPro;
  const [token, setToken] = useState("");
  const [repoName, setRepoName] = useState(defaultRepoName);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [isPrivate, setIsPrivate] = useState(true);
  const [branch, setBranch] = useState("main");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [result, setResult] = useState<{ url: string; sha: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRepoName(defaultRepoName);
      setDescription(defaultDescription ?? "");
      setResult(null);
      setNeedsConfirm(false);
      setConfirmOverwrite(false);
    }
  }, [open, defaultRepoName, defaultDescription]);

  const connectMut = useMutation({
    mutationFn: (t: string) => connectFn({ data: { token: t } }),
    onSuccess: () => {
      toast.success("GitHub connected");
      setToken("");
      qc.invalidateQueries({ queryKey: ["githubConnection"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to connect"),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => {
      toast.success("GitHub disconnected");
      qc.invalidateQueries({ queryKey: ["githubConnection"] });
    },
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      setProgress("Preparing files…");
      const r = await publishFn({
        data: {
          repoName, description, isPrivate, branch,
          overwrite: confirmOverwrite,
          sourceKind, sourceId, files,
          commitMessage: `Publish from IntelliVerse AI`,
        },
      });
      return r;
    },
    onSuccess: (r: any) => {
      setProgress(null);
      if (r?.needsConfirmOverwrite) {
        setNeedsConfirm(true);
        toast.warning("Repository already exists. Confirm overwrite to continue.");
        return;
      }
      setResult({ url: r.repoUrl, sha: r.commitSha });
      qc.invalidateQueries({ queryKey: ["publishHistory"] });
      toast.success("Published to GitHub");
    },
    onError: (e: any) => {
      setProgress(null);
      toast.error(e?.message || "Publish failed");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Publish to GitHub
            {isPro && (
              <Badge className="ml-1 bg-gradient-to-r from-amber-500 to-rose-500 text-white">
                <ShieldCheck className="mr-1 h-3 w-3" /> Pro
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Push this project straight to your own GitHub account.
          </DialogDescription>
        </DialogHeader>

        {connLoading ? (
          <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !conn ? (
          <ConnectStep
            token={token} setToken={setToken}
            onConnect={() => connectMut.mutate(token)}
            pending={connectMut.isPending}
          />
        ) : result ? (
          <SuccessStep result={result} isPro={isPro} onClose={() => onOpenChange(false)} />
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Github className="h-4 w-4" /> Connected as <b>{conn.github_username}</b>
                </span>
                <Button size="sm" variant="ghost" onClick={() => disconnectMut.mutate()} disabled={disconnectMut.isPending}>
                  Disconnect
                </Button>
              </div>

              {!isPro && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                    <Sparkles className="h-3.5 w-3.5" /> Free plan
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    A small "Built with IntelliVerse AI" watermark and source comments will be added.{" "}
                    <a href="/#pricing" className="underline">Upgrade to Pro</a> to publish a clean, unbranded project.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Repository name</Label>
                  <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="my-project" />
                </div>
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} />
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Private repository</p>
                  <p className="text-xs text-muted-foreground">Only you can see it.</p>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>

              {needsConfirm && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
                  <p className="font-medium text-destructive">Repository already exists.</p>
                  <p className="mt-1 text-muted-foreground">This will overwrite its contents on <b>{branch}</b>.</p>
                  <label className="mt-2 flex items-center gap-2">
                    <input type="checkbox" checked={confirmOverwrite} onChange={(e) => setConfirmOverwrite(e.target.checked)} />
                    Yes, I want to overwrite.
                  </label>
                </div>
              )}

              {progress && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> {progress}
                </div>
              )}

              {history && history.length > 0 && (
                <div className="rounded-lg border bg-muted/20 p-2 text-xs">
                  <p className="mb-1 font-medium">Recent publishes</p>
                  <ul className="space-y-1 max-h-24 overflow-y-auto">
                    {history.slice(0, 5).map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">{h.repo_owner}/{h.repo_name} <span className="text-muted-foreground">· {h.branch}</span></span>
                        <a href={h.repo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                          open <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={() => publishMut.mutate()}
                disabled={publishMut.isPending || (needsConfirm && !confirmOverwrite) || !repoName}
              >
                {publishMut.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing…</>
                ) : (
                  <><Github className="mr-2 h-4 w-4" /> {needsConfirm ? "Overwrite & Publish" : "Publish"}</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConnectStep({ token, setToken, onConnect, pending }: {
  token: string; setToken: (v: string) => void; onConnect: () => void; pending: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3 text-xs">
        <p className="font-medium">Connect your GitHub account</p>
        <ol className="ml-4 mt-1 list-decimal space-y-1 text-muted-foreground">
          <li>Open{" "}
            <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer" className="text-primary underline">
              github.com/settings/tokens
            </a>
          </li>
          <li>Create a <b>fine-grained</b> or <b>classic</b> token with the <code>repo</code> scope.</li>
          <li>Paste it below — it's stored securely and never exposed.</li>
        </ol>
      </div>
      <div className="space-y-1.5">
        <Label>GitHub Access Token</Label>
        <Input
          type="password"
          autoComplete="off"
          placeholder="ghp_… or github_pat_…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button onClick={onConnect} disabled={pending || token.length < 20}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-4 w-4" />}
          Connect GitHub
        </Button>
      </DialogFooter>
    </div>
  );
}

function SuccessStep({ result, isPro, onClose }: { result: { url: string; sha: string }; isPro: boolean; onClose: () => void }) {
  return (
    <div className="space-y-3 py-2">
      <div className="grid place-items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="mt-3 text-lg font-semibold">Published successfully</h3>
        <p className="text-xs text-muted-foreground">Commit {result.sha.slice(0, 7)}</p>
        {isPro && (
          <Badge className="mt-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white">
            <ShieldCheck className="mr-1 h-3 w-3" /> Pro Verified — clean build
          </Badge>
        )}
      </div>
      <div className="flex justify-center gap-2">
        <Button asChild>
          <a href={result.url} target="_blank" rel="noreferrer">
            <Github className="mr-2 h-4 w-4" /> Open repository <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </a>
        </Button>
        <Button variant="outline" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
