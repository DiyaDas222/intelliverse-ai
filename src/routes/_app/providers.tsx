import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Shield, CheckCircle2, XCircle, Loader2, ChevronLeft, Power } from "lucide-react";
import { listProviderStatuses, toggleProvider } from "@/lib/providers.functions";
import { CATEGORY_LABEL, type ProviderCategory, type ProviderStatus } from "@/lib/providers";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_app/providers")({
  head: () => ({ meta: [{ title: "Providers — IntelliVerse Admin" }] }),
  component: ProvidersPage,
});

function ProvidersPage() {
  const checkAdmin = useServerFn(checkIsAdmin);
  const listFn = useServerFn(listProviderStatuses);
  const toggleFn = useServerFn(toggleProvider);
  const qc = useQueryClient();

  const { data: admin, isLoading: aLoad } = useQuery({
    queryKey: ["isAdminProviders"],
    queryFn: () => checkAdmin(),
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["providerStatuses"],
    queryFn: () => listFn(),
    enabled: !!admin?.isAdmin,
  });

  const toggleMut = useMutation({
    mutationFn: (data: { id: string; enabled: boolean }) => toggleFn({ data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providerStatuses"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (aLoad)
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (!admin?.isAdmin)
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </div>
    );

  const byCat = (providers ?? []).reduce<Record<string, ProviderStatus[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-3 w-3" /> Admin
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-semibold sm:text-2xl">AI Provider Management</h1>
          <p className="text-xs text-muted-foreground">
            Toggle which providers are exposed to users. API keys are stored as server-side secrets — add them in Project Settings → Secrets using the listed env var names.
          </p>
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          (Object.keys(byCat) as ProviderCategory[]).map((cat) => (
            <div key={cat} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABEL[cat]}
              </h2>
              <div className="space-y-2">
                {byCat[cat].map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{p.name}</p>
                        {p.configured ? (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500">
                            <CheckCircle2 className="h-3 w-3" /> Key set
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500">
                            <XCircle className="h-3 w-3" /> No key
                          </span>
                        )}
                      </div>
                      {p.notes && <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p>}
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        env: {p.env_vars.join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleMut.mutate({ id: p.id, enabled: !p.enabled })}
                      disabled={toggleMut.isPending || p.id === "lovable-ai"}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs disabled:opacity-50 ${
                        p.enabled
                          ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      <Power className="h-3 w-3" />
                      {p.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How to add an API key</p>
          <p className="mt-1">
            Add the secret in <strong>Admin → Settings → Secrets</strong>, paste the env-var
            name shown above (e.g. <code className="rounded bg-muted px-1">OPENAI_API_KEY</code>) and the key value.
            Features gate on the live presence of these env vars at runtime.
          </p>
        </div>
      </div>
    </div>
  );
}
