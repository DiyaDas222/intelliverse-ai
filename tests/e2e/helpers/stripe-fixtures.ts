import { createHmac } from "node:crypto";

/** Build a signed Stripe webhook Request the real verifyWebhook accepts. */
export function buildSignedRequest(opts: {
  event: any;
  env: "sandbox" | "live";
  secret?: string;
  url?: string;
  timestamp?: number;
}): Request {
  const secret =
    opts.secret ??
    (opts.env === "sandbox"
      ? process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET!
      : process.env.PAYMENTS_LIVE_WEBHOOK_SECRET!);
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const body = JSON.stringify(opts.event);
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const url =
    opts.url ?? `https://app.test/api/public/payments/webhook?env=${opts.env}`;
  return new Request(url, {
    method: "POST",
    headers: {
      "stripe-signature": `t=${ts},v1=${sig}`,
      "content-type": "application/json",
    },
    body,
  });
}

export function subscriptionEvent(overrides: {
  type?: string;
  id?: string;
  userId: string;
  customer?: string;
  status?: string;
  priceLookupKey?: string;
  cancelAtPeriodEnd?: boolean;
  periodEnd?: number;
} = { userId: "" }): any {
  const periodEnd = overrides.periodEnd ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  return {
    id: "evt_" + Math.random().toString(36).slice(2),
    type: overrides.type ?? "customer.subscription.created",
    data: {
      object: {
        id: overrides.id ?? "sub_test_1",
        customer: overrides.customer ?? "cus_test_1",
        status: overrides.status ?? "active",
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
        metadata: { userId: overrides.userId },
        items: {
          data: [
            {
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: periodEnd,
              price: {
                id: "price_stripe_internal",
                lookup_key: overrides.priceLookupKey ?? "pro_monthly",
                product: "prod_test",
              },
            },
          ],
        },
      },
    },
  };
}

export function checkoutCompletedEvent(opts: {
  userId: string;
  sessionId?: string;
  mode?: "payment" | "subscription";
}): any {
  return {
    id: "evt_co_" + Math.random().toString(36).slice(2),
    type: "checkout.session.completed",
    data: {
      object: {
        id: opts.sessionId ?? "cs_test_1",
        mode: opts.mode ?? "payment",
        amount_total: 500,
        currency: "usd",
        metadata: { userId: opts.userId },
      },
    },
  };
}
