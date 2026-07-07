import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RZP_BASE = "https://api.razorpay.com/v1";

function basicAuth(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay is not configured");
  return "Basic " + btoa(`${id}:${secret}`);
}

function environment(): "live" | "test" {
  return (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_live") ? "live" : "test";
}

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

/**
 * Creates a Razorpay order for a specific plan.
 * The amount is read from the `plans` table server-side — the client cannot
 * spoof the price by sending a lower amount.
 */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_id: string }) => {
    if (!d?.plan_id || typeof d.plan_id !== "string") throw new Error("plan_id required");
    return d;
  })
  .handler(async ({ data, context }) => {
    // 1) Look up the authoritative price from the database.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("plans")
      .select("id,name,price_paise,currency,duration_days,is_active")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);
    if (!plan || !plan.is_active) throw new Error("Plan not available");

    // 2) Create the Razorpay order.
    const receipt = `up_${context.userId.slice(0, 8)}_${Date.now()}`;
    const res = await fetch(`${RZP_BASE}/orders`, {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: plan.price_paise,
        currency: plan.currency,
        receipt,
        notes: { user_id: context.userId, plan_id: plan.id },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[razorpay] order failed", res.status, body);
      throw new Error(body?.error?.description ?? `Razorpay error (${res.status})`);
    }

    // 3) Record the intent in `payments` (status=created). Idempotent on order id.
    await supabaseAdmin.from("payments").upsert(
      {
        user_id: context.userId,
        plan_id: plan.id,
        razorpay_order_id: body.id,
        amount_paise: plan.price_paise,
        currency: plan.currency,
        status: "created",
        environment: environment(),
      } as never,
      { onConflict: "razorpay_order_id" },
    );

    return {
      order_id: body.id as string,
      amount: body.amount as number,
      currency: body.currency as string,
      key_id: process.env.RAZORPAY_KEY_ID!,
      plan: { id: plan.id, name: plan.name, duration_days: plan.duration_days },
    };
  });

/**
 * Verifies the signature returned by the checkout modal and grants entitlement.
 * Idempotent: the same payment_id will never create two subscriptions.
 */
export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    if (!d?.razorpay_order_id || !d?.razorpay_payment_id || !d?.razorpay_signature) {
      throw new Error("Missing payment fields");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error("Razorpay is not configured");

    // 1) Verify HMAC.
    const expected = await hmacSha256Hex(
      secret,
      `${data.razorpay_order_id}|${data.razorpay_payment_id}`,
    );
    if (!timingSafeEqualHex(expected, data.razorpay_signature)) {
      throw new Error("Signature verification failed");
    }

    // 2) Fetch the pre-recorded payment intent (created during order creation)
    // to know which plan + amount to trust.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: paymentRow, error: pErr } = await supabaseAdmin
      .from("payments")
      .select("id,user_id,plan_id,amount_paise,currency,status")
      .eq("razorpay_order_id", data.razorpay_order_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!paymentRow) throw new Error("Payment record not found. Please contact support.");
    if (paymentRow.user_id !== context.userId) throw new Error("Payment does not belong to this user");

    const { data: plan, error: plErr } = await supabaseAdmin
      .from("plans")
      .select("id,duration_days")
      .eq("id", paymentRow.plan_id)
      .single();
    if (plErr || !plan) throw new Error("Plan not found");

    // 3) Mark payment captured (idempotent).
    await supabaseAdmin
      .from("payments")
      .update({
        razorpay_payment_id: data.razorpay_payment_id,
        status: "captured",
        captured_at: new Date().toISOString(),
      } as never)
      .eq("id", paymentRow.id);

    // 4) Grant/extend subscription (idempotent via payment_id unique index).
    const now = new Date();
    const currentEnd = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
    const { error: subErr } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        payment_id: paymentRow.id,
        plan_id: plan.id,
        stripe_subscription_id: data.razorpay_payment_id, // legacy col
        stripe_customer_id: data.razorpay_order_id, // legacy col
        product_id: plan.id,
        price_id: "razorpay",
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: currentEnd.toISOString(),
        cancel_at_period_end: false,
        environment: environment(),
      } as never,
      { onConflict: "payment_id" },
    );
    if (subErr) console.error("[razorpay] subscription upsert failed", subErr);

    return {
      ok: true,
      payment_id: data.razorpay_payment_id,
      plan_id: plan.id,
      current_period_end: currentEnd.toISOString(),
    };
  });
