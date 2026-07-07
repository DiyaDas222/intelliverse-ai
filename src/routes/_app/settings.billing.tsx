import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Loader2, ReceiptText, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getEntitlements, listMyPayments, cancelSubscription, reactivateSubscription,
} from "@/lib/entitlements.functions";

export const Route = createFileRoute("/_app/settings/billing")({
  component: BillingPage,
});

function formatINR(paise: number, currency = "INR"): string {
  if (currency !== "INR") return `${currency} ${(paise / 100).toFixed(2)}`;
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function BillingPage() {
  const entFn = useServerFn(getEntitlements);
  const paymentsFn = useServerFn(listMyPayments);
  const cancelFn = useServerFn(cancelSubscription);
  const reactivateFn = useServerFn(reactivateSubscription);
  const qc = useQueryClient();

  const { data: ent, isLoading } = useQuery({ queryKey: ["entitlements"], queryFn: () => entFn() });
  const { data: payments = [] } = useQuery({ queryKey: ["myPayments"], queryFn: () => paymentsFn() });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn(),
    onSuccess: () => {
      toast.success("Auto-renew cancelled. You keep Pro until the current period ends.");
      qc.invalidateQueries({ queryKey: ["entitlements"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not cancel"),
  });
  const reMut = useMutation({
    mutationFn: () => reactivateFn(),
    onSuccess: () => {
      toast.success("Subscription reactivated.");
      qc.invalidateQueries({ queryKey: ["entitlements"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not reactivate"),
  });

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/settings" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your plan, invoices, and usage.</p>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Plan card */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    {ent?.is_pro ? (
                      <BadgeCheck className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h2 className="text-lg font-semibold">
                      {ent?.is_pro ? `You're on ${ent.plan}` : "Free plan"}
                    </h2>
                  </div>
                  {ent?.is_pro && ent.current_period_end && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ent.cancel_at_period_end
                        ? <>Ends on <b>{new Date(ent.current_period_end).toLocaleDateString()}</b> — will not renew.</>
                        : <>Valid until <b>{new Date(ent.current_period_end).toLocaleDateString()}</b>. This plan does not auto-renew — you'll need to buy again.</>}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!ent?.is_pro && (
                    <Link to="/upgrade">
                      <Button className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white">Upgrade to Pro</Button>
                    </Link>
                  )}
                  {ent?.is_pro && ent.cancel_at_period_end && (
                    <Button variant="outline" onClick={() => reMut.mutate()} disabled={reMut.isPending}>
                      {reMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Undo cancel
                    </Button>
                  )}
                  {ent?.is_pro && !ent.cancel_at_period_end && (
                    <Button variant="outline" onClick={() => {
                      if (confirm("Cancel auto-renew? You'll keep Pro until the current period ends.")) cancelMut.mutate();
                    }} disabled={cancelMut.isPending}>
                      {cancelMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <XCircle className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Usage card */}
            <div className="mt-4 rounded-2xl border border-border/60 bg-card p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Usage · {ent?.period_key}</h2>
              <div className="mt-3 space-y-3">
                {(["chat", "generation", "vibe"] as const).map((k) => {
                  const used = ent?.usage[k] ?? 0;
                  const limit = ent?.limits[k];
                  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                  const label = k === "chat" ? "AI chat messages" : k === "generation" ? "Image / audio / video generations" : "New Vibe projects";
                  return (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{label}</span>
                        <span className="text-muted-foreground">
                          {used}{limit ? ` / ${limit}` : " · unlimited"}
                        </span>
                      </div>
                      {limit != null && (
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                          <div
                            className={`h-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-fuchsia-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment history */}
            <div className="mt-4 rounded-2xl border border-border/60 bg-card p-6">
              <div className="mb-3 flex items-center gap-2">
                <ReceiptText className="h-4 w-4" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payment history</h2>
              </div>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 text-left font-medium">Date</th>
                        <th className="py-2 text-left font-medium">Plan</th>
                        <th className="py-2 text-right font-medium">Amount</th>
                        <th className="py-2 text-left font-medium">Status</th>
                        <th className="py-2 text-left font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-t border-border/40">
                          <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                          <td className="py-2">{p.plan_id}</td>
                          <td className="py-2 text-right">{formatINR(p.amount_paise, p.currency)}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] ${p.status === "captured" ? "bg-emerald-500/10 text-emerald-500" : p.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground"}`}>
                              {p.status}
                            </span>
                            {p.environment === "test" && <span className="ml-1 text-[10px] text-muted-foreground">(test)</span>}
                          </td>
                          <td className="py-2 font-mono text-[11px] text-muted-foreground">
                            {p.razorpay_payment_id ?? p.razorpay_order_id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
