import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Zap } from "lucide-react";
import { RazorpayPayButton } from "@/components/razorpay-checkout";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Buy Credits — IntelliVerse AI" }] }),
  component: UpgradePage,
});

const CREDIT_PACKS: { id: string; credits: number; price: string; per: string; badge?: string }[] = [
  { id: "credits_small_onetime", credits: 100, price: "$5", per: "$0.05 / credit" },
  { id: "credits_medium_onetime", credits: 500, price: "$20", per: "$0.04 / credit", badge: "Best value" },
  { id: "credits_large_onetime", credits: 1500, price: "$50", per: "$0.033 / credit" },
];

function UpgradePage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/studio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Studio
        </Link>

        <div className="mt-4 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Buy Credits</h1>
          <p className="mt-2 text-muted-foreground">One-time credit packs. Credits never expire.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CREDIT_PACKS.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border/60 bg-card/40 p-5">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="text-lg font-semibold">{p.credits} credits</span>
                {p.badge && (
                  <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    {p.badge}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{p.price}</span>
                <span className="text-xs text-muted-foreground">{p.per}</span>
              </div>
              <div className="mt-4">
                <RazorpayPayButton
                  packId={p.id}
                  label={`Buy ${p.credits} credits — ${p.price}`}
                  onSuccess={() => {
                    setSelected(p.id);
                    qc.invalidateQueries({ queryKey: ["credits-summary"] });
                  }}
                />
              </div>
              {selected === p.id && (
                <p className="mt-2 text-center text-[11px] text-emerald-600">✓ Credits added to your account</p>
              )}
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Secure payments by Razorpay. Cards, UPI, netbanking, and wallets supported.
        </p>
      </div>
    </div>
  );
}
