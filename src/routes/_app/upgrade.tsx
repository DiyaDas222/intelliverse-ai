import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ShieldCheck, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StripeEmbeddedCheckout, PaymentTestModeBanner } from "@/components/stripe-embedded-checkout";

export const Route = createFileRoute("/_app/upgrade")({
  head: () => ({ meta: [{ title: "Upgrade to Pro — IntelliVerse AI" }] }),
  component: UpgradePage,
});

const FEATURES = [
  "Publish completely clean code to GitHub (no branding or watermarks)",
  "Pro Verified badge on every publish",
  "Higher generation limits",
  "Priority access to new models",
  "Remove watermark from generated websites & apps",
];

function UpgradePage() {
  const [priceId, setPriceId] = useState<"pro_monthly" | "pro_yearly">("pro_monthly");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <div className="min-h-full">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/studio" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Back to Studio
        </Link>

        <div className="mt-4 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-3 py-1 text-xs font-medium text-white">
            <ShieldCheck className="h-3 w-3" /> IntelliVerse Pro
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Ship clean, professional projects</h1>
          <p className="mt-2 text-muted-foreground">Remove all branding. Publish production-ready code to GitHub.</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Plan card */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <h2 className="text-lg font-semibold">Choose your plan</h2>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setPriceId("pro_monthly")}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${priceId === "pro_monthly" ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}
              >
                <div>
                  <p className="font-medium">Monthly</p>
                  <p className="text-xs text-muted-foreground">Cancel anytime</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">$5</p>
                  <p className="text-[10px] text-muted-foreground">/month</p>
                </div>
              </button>
              <button
                onClick={() => setPriceId("pro_yearly")}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${priceId === "pro_yearly" ? "border-primary bg-primary/5" : "border-border/60 hover:border-border"}`}
              >
                <div>
                  <p className="font-medium flex items-center gap-2">
                    Yearly
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">Save 17%</span>
                  </p>
                  <p className="text-xs text-muted-foreground">$50/year</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">$4.17</p>
                  <p className="text-[10px] text-muted-foreground">/month, billed yearly</p>
                </div>
              </button>
            </div>

            <ul className="mt-6 space-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {!checkoutOpen && (
              <Button className="mt-6 w-full" size="lg" onClick={() => setCheckoutOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" /> Continue to checkout
              </Button>
            )}
          </div>

          {/* Checkout */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
            {checkoutOpen ? (
              <StripeEmbeddedCheckout priceId={priceId} />
            ) : (
              <div className="grid h-full min-h-[300px] place-items-center text-center text-sm text-muted-foreground">
                Select a plan and click <b className="mx-1">Continue to checkout</b> to enter payment details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
