// Razorpay webhook — safety net for cases where the client never returns
// to the app to call verifyRazorpayPayment (tab closed, network drop, etc.).
// Public endpoint; must be verified via HMAC(RAZORPAY_WEBHOOK_SECRET, raw body).
//
// Configure in Razorpay dashboard → Settings → Webhooks:
//   URL:    https://<your-domain>/api/public/razorpay-webhook
//   Events: payment.captured, payment.failed
//   Secret: value stored in RAZORPAY_WEBHOOK_SECRET

import { createFileRoute } from "@tanstack/react-router";

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}

type WebhookEvent = {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        order_id: string;
        status: string;
        amount: number;
        currency: string;
        error_description?: string;
      };
    };
  };
};

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 500 });

        const signature = request.headers.get("x-razorpay-signature") ?? "";
        const raw = await request.text();

        const expected = await hmacSha256Hex(secret, raw);
        if (!signature || !timingSafeEqualHex(expected, signature)) {
          console.warn("[razorpay-webhook] bad signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let evt: WebhookEvent;
        try {
          evt = JSON.parse(raw) as WebhookEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const payment = evt.payload?.payment?.entity;
        if (!payment) return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Look up the payments row we created at order-time.
        const { data: paymentRow } = await supabaseAdmin
          .from("payments")
          .select("id,user_id,plan_id,status")
          .eq("razorpay_order_id", payment.order_id)
          .maybeSingle();

        if (!paymentRow) {
          console.warn("[razorpay-webhook] no payment row for order", payment.order_id);
          return new Response("ok", { status: 200 });
        }

        if (evt.event === "payment.captured") {
          // Idempotent: if already captured we skip.
          if (paymentRow.status !== "captured") {
            await supabaseAdmin
              .from("payments")
              .update({
                razorpay_payment_id: payment.id,
                status: "captured",
                captured_at: new Date().toISOString(),
              } as never)
              .eq("id", paymentRow.id);
          }

          // Grant subscription if not already granted (idempotent via unique payment_id).
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("duration_days")
            .eq("id", paymentRow.plan_id)
            .single();
          if (plan) {
            const now = new Date();
            const end = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
            const env = payment.id.startsWith("pay_") && (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_live") ? "live" : "test";
            await supabaseAdmin.from("subscriptions").upsert(
              {
                user_id: paymentRow.user_id,
                payment_id: paymentRow.id,
                plan_id: paymentRow.plan_id,
                stripe_subscription_id: payment.id,
                stripe_customer_id: payment.order_id,
                product_id: paymentRow.plan_id,
                price_id: "razorpay",
                status: "active",
                current_period_start: now.toISOString(),
                current_period_end: end.toISOString(),
                cancel_at_period_end: false,
                environment: env,
              } as never,
              { onConflict: "payment_id" },
            );
          }
        } else if (evt.event === "payment.failed") {
          await supabaseAdmin
            .from("payments")
            .update({
              razorpay_payment_id: payment.id,
              status: "failed",
              metadata: { error: payment.error_description ?? null },
            } as never)
            .eq("id", paymentRow.id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
