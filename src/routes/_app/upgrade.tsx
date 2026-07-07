import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Check, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/razorpay.functions";

export const Route = createFileRoute("/_app/upgrade")({
  component: UpgradePage,
});

type RzpResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const PLANS = [
  {
    id: "pro-monthly",
    name: "Pro",
    price: 49900, // ₹499
    priceLabel: "₹499",
    period: "/month",
    features: [
      "Remove branding & watermarks",
      "Publish clean projects to GitHub",
      "Unlimited Vibe Coding projects",
      "Priority AI responses",
      "Pro Verified badge",
    ],
  },
  {
    id: "pro-yearly",
    name: "Pro Yearly",
    price: 499900, // ₹4,999
    priceLabel: "₹4,999",
    period: "/year",
    features: [
      "Everything in Pro",
      "2 months free",
      "Early access to new features",
    ],
    highlight: true,
  },
];

function UpgradePage() {
  const createOrder = useServerFn(createRazorpayOrder);
  const verify = useServerFn(verifyRazorpayPayment);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => { void loadRazorpay(); }, []);

  const pay = async (plan: typeof PLANS[number]) => {
    setLoadingPlan(plan.id);
    try {
      const ok = await loadRazorpay();
      if (!ok || !window.Razorpay) throw new Error("Payment SDK failed to load");

      const order = await createOrder({
        data: { amount: plan.price, currency: "INR", receipt: `up_${Date.now()}`, notes: { plan: plan.id } },
      });

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "IntelliVerse AI",
        description: `${plan.name} plan`,
        theme: { color: "#8b5cf6" },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
            toast.message("Payment cancelled");
          },
        },
        handler: async (resp: RzpResponse) => {
          try {
            await verify({
              data: {
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                plan: plan.id,
              },
            });
            toast.success("Welcome to Pro! 🎉");
            setTimeout(() => { window.location.href = "/dashboard"; }, 800);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Verification failed");
          } finally {
            setLoadingPlan(null);
          }
        },
      });

      rzp.on("payment.failed", (r: unknown) => {
        const err = (r as { error?: { description?: string } })?.error?.description ?? "Payment failed";
        toast.error(err);
        setLoadingPlan(null);
      });

      rzp.open();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start payment");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-10 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Upgrade to Pro</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Ship clean, unbranded projects. Publish to GitHub without watermarks. Get priority AI.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`relative rounded-2xl border p-6 ${p.highlight ? "border-fuchsia-500/60 bg-gradient-to-b from-fuchsia-500/5 to-transparent" : "border-border/60 bg-card"}`}
            >
              {p.highlight && (
                <span className="absolute -top-2 right-4 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                  Best value
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{p.priceLabel}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white"
                onClick={() => pay(p)}
                disabled={loadingPlan !== null}
              >
                {loadingPlan === p.id ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening checkout…</>
                ) : (
                  <>Pay {p.priceLabel}</>
                )}
              </Button>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Secure payments by Razorpay. Test mode — use card 4111 1111 1111 1111, any future date, any CVV.
        </p>
      </div>
    </div>
  );
}
