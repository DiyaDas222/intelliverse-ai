import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Zap, ShieldCheck, Users, Check } from "lucide-react";
import { RazorpayPayButton } from "@/components/razorpay-checkout";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — IntelliVerse AI" }] }),
  component: UpgradePage,
});

const PLANS = [
  {
    id: "pro_month_pass",
    name: "Pro — 1 month",
    price: "$5",
    per: "one-time",
    credits: 2000,
    icon: ShieldCheck,
    gradient: "from-amber-500 to-rose-500",
    features: ["2,000 credits included", "Priority models", "No watermark on generated sites"],
    badge: "Most popular",
  },
  {
    id: "pro_year_pass",
    name: "Pro — 1 year",
    price: "$50",
    per: "one-time",
    credits: 25000,
    icon: ShieldCheck,
    gradient: "from-indigo-500 to-fuchsia-500",
    features: ["25,000 credits included", "Everything in Pro monthly", "Save $10 vs monthly"],
    badge: "Best value",
  },
  {
    id: "team_month_pass",
    name: "Team — 1 month",
    price: "$15",
    per: "one-time",
    credits: 8000,
    icon: Users,
    gradient: "from-emerald-500 to-teal-500",
    features: ["8,000 credits included", "Bulk publish to GitHub", "Priority support"],
  },
];

const CREDIT_PACKS = [
  { id: "credits_small_onetime", credits: 100, price: "$5", per: "$0.05 / credit" },
  { id: "credits_medium_onetime", credits: 500, price: "$20", per: "$0.04 / credit", badge: "Best value" },
  { id: "credits_large_onetime", credits: 1500, price: "$50", per: "$0.033 / credit" },
];

function UpgradePage() {
  const qc = useQueryClient();
  const [purchased, setPurchased] = useState<string | null>(null);

  const onSuccess = (id: string) => {
    setPurchased(id);
    qc.invalidateQueries({ queryKey: ["credits-summary"] });
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link to="/studio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Studio
        </Link>

        <div className="mt-4 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Upgrade your plan</h1>
          <p className="mt-2 text-muted-foreground">One-time purchases via Razorpay. Cards, UPI, netbanking, and wallets.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLANS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.id} className="relative rounded-2xl border border-border/60 bg-card/40 p-5">
                {p.badge && (
                  <div className="absolute -top-3 left-5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {p.badge}
                  </div>
                )}
                <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${p.gradient} px-3 py-1 text-xs font-medium text-white`}>
                  <Icon className="h-3 w-3" /> {p.name}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-xs text-muted-foreground">{p.per}</span>
                </div>
                <ul className="mt-4 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  <RazorpayPayButton
                    packId={p.id}
                    label={`Buy ${p.name} — ${p.price}`}
                    onSuccess={() => onSuccess(p.id)}
                  />
                </div>
                {purchased === p.id && (
                  <p className="mt-2 text-center text-[11px] text-emerald-600">✓ Purchase successful — credits added</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-14">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Or top up with credit packs</h2>
            <p className="mt-1 text-sm text-muted-foreground">Credits never expire and stack with any plan.</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
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
                    onSuccess={() => onSuccess(p.id)}
                  />
                </div>
                {purchased === p.id && (
                  <p className="mt-2 text-center text-[11px] text-emerald-600">✓ Credits added</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Secure payments by Razorpay.
        </p>
      </div>
    </div>
  );
}
