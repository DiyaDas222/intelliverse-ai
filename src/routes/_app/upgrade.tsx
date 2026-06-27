import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ShieldCheck, Sparkles, ArrowLeft, Users, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StripeEmbeddedCheckout, PaymentTestModeBanner } from "@/components/stripe-embedded-checkout";
import { changeSubscriptionPlan, getCurrentPlan, createPortalSession } from "@/lib/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade — IntelliVerse AI" }] }),
  component: UpgradePage,
});

type Tier = "pro" | "team";
type Cycle = "monthly" | "yearly";
type PriceId = "pro_monthly" | "pro_yearly" | "team_monthly" | "team_yearly";

const TIERS: Record<Tier, {
  label: string;
  icon: typeof ShieldCheck;
  gradient: string;
  blurb: string;
  features: string[];
  prices: Record<Cycle, { id: PriceId; monthly: string; total: string; note?: string }>;
}> = {
  pro: {
    label: "Pro",
    icon: ShieldCheck,
    gradient: "from-amber-500 to-rose-500",
    blurb: "Ship clean, professional projects.",
    features: [
      "Publish completely clean code to GitHub (no branding)",
      "Pro Verified badge on every publish",
      "Higher generation limits",
      "Priority access to new models",
      "Remove watermark from generated sites & apps",
    ],
    prices: {
      monthly: { id: "pro_monthly", monthly: "$5", total: "$5 / month" },
      yearly: { id: "pro_yearly", monthly: "$4.17", total: "$50 / year", note: "Save 17%" },
    },
  },
  team: {
    label: "Team",
    icon: Users,
    gradient: "from-indigo-500 to-fuchsia-500",
    blurb: "Everything in Pro, scaled for teams.",
    features: [
      "Everything in Pro",
      "5× higher generation limits",
      "Shared library & projects",
      "Bulk publish to GitHub",
      "Priority support",
    ],
    prices: {
      monthly: { id: "team_monthly", monthly: "$15", total: "$15 / month" },
      yearly: { id: "team_yearly", monthly: "$12.50", total: "$150 / year", note: "Save 17%" },
    },
  },
};

const CREDIT_PACKS: { id: string; credits: number; price: string; per: string; badge?: string }[] = [
  { id: "credits_small_onetime", credits: 100, price: "$5", per: "$0.05 / credit" },
  { id: "credits_medium_onetime", credits: 500, price: "$20", per: "$0.04 / credit", badge: "Best value" },
  { id: "credits_large_onetime", credits: 1500, price: "$50", per: "$0.033 / credit" },
];

function UpgradePage() {
  const [tier, setTier] = useState<Tier>("pro");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [packPriceId, setPackPriceId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await createPortalSession({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in res) throw new Error(res.error);
      window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  const selected = TIERS[tier].prices[cycle];
  const isCurrentPlan = currentPriceId === selected.id;
  const hasSubscription = !!currentPriceId;

  useEffect(() => {
    getCurrentPlan({ data: { environment: getStripeEnvironment() } })
      .then((res) => {
        if (res.subscribed) setCurrentPriceId(res.priceId);
      })
      .catch(() => null);
  }, []);

  async function handleSwitch() {
    setSwitching(true);
    try {
      const res = await changeSubscriptionPlan({
        data: { newPriceId: selected.id, environment: getStripeEnvironment() },
      });
      if ("error" in res) throw new Error(res.error);
      setCurrentPriceId(selected.id);
      toast.success("Plan updated. Stripe charged the prorated difference.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to change plan");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="min-h-full">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link to="/studio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Studio
        </Link>

        <div className="mt-4 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Pick the plan that fits</h1>
          <p className="mt-2 text-muted-foreground">Upgrade, downgrade, or cancel anytime. Plan changes are prorated.</p>

          {/* Billing cycle toggle */}
          <div className="mt-6 inline-flex rounded-full border border-border/60 bg-card/40 p-1 text-sm">
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`rounded-full px-4 py-1.5 transition ${cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {c === "monthly" ? "Monthly" : "Yearly — save 17%"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {(Object.keys(TIERS) as Tier[]).map((t) => {
            const T = TIERS[t];
            const Icon = T.icon;
            const price = T.prices[cycle];
            const active = tier === t;
            const isCurrent = currentPriceId === price.id;
            return (
              <button
                key={t}
                onClick={() => { setTier(t); setCheckoutOpen(false); }}
                className={`text-left rounded-2xl border p-6 transition ${active ? "border-primary bg-primary/5" : "border-border/60 bg-card/40 hover:border-border"}`}
              >
                <div className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${T.gradient} px-3 py-1 text-xs font-medium text-white`}>
                  <Icon className="h-3 w-3" /> IntelliVerse {T.label}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{T.blurb}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{price.monthly}</span>
                  <span className="text-xs text-muted-foreground">/ month</span>
                  {price.note && (
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">{price.note}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{price.total}</p>
                {isCurrent && (
                  <p className="mt-2 text-[11px] font-medium text-emerald-600">✓ Your current plan</p>
                )}
                <ul className="mt-5 space-y-2">
                  {T.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-4">
          {hasSubscription && !isCurrentPlan ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Switch from <b>{currentPriceId}</b> to <b>{selected.id}</b>. Stripe will charge or credit the prorated difference immediately.
              </p>
              <Button size="lg" onClick={handleSwitch} disabled={switching}>
                {switching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Switch to {TIERS[tier].label} {cycle === "yearly" ? "Yearly" : "Monthly"}
              </Button>
            </div>
          ) : isCurrentPlan ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">You're already on this plan.</p>
              <Button size="lg" variant="outline" onClick={openPortal} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Manage subscription
              </Button>
            </div>
          ) : checkoutOpen ? (
            <StripeEmbeddedCheckout priceId={selected.id} />
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <Button size="lg" onClick={() => setCheckoutOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Continue to checkout — {selected.total}
              </Button>
              <p className="text-[11px] text-muted-foreground">Secure payment by Stripe. Cancel anytime.</p>
            </div>
          )}
        </div>

        {/* Credit Packs — one-time top-ups */}
        <div className="mt-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Need a quick top-up?</h2>
            <p className="mt-1 text-sm text-muted-foreground">One-time credit packs. Credits never expire and stack with your plan.</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {CREDIT_PACKS.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border/60 bg-card/40 p-5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-lg font-semibold">{p.credits} credits</span>
                  {p.badge && (
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">{p.badge}</span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{p.price}</span>
                  <span className="text-xs text-muted-foreground">{p.per}</span>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant={packPriceId === p.id ? "secondary" : "default"}
                  onClick={() => setPackPriceId(packPriceId === p.id ? null : p.id)}
                >
                  {packPriceId === p.id ? "Close" : "Buy pack"}
                </Button>
              </div>
            ))}
          </div>
          {packPriceId && (
            <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-4">
              <StripeEmbeddedCheckout priceId={packPriceId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
