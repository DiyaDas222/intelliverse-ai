import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RZP_BASE = "https://api.razorpay.com/v1";

function auth() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay credentials not configured");
  return "Basic " + btoa(`${id}:${secret}`);
}

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amount: number; currency?: string; receipt?: string; notes?: Record<string, string> }) => {
    if (!Number.isFinite(d.amount) || d.amount < 100) {
      throw new Error("Amount must be at least 100 paise (₹1)");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const res = await fetch(`${RZP_BASE}/orders`, {
      method: "POST",
      headers: { Authorization: auth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(data.amount),
        currency: data.currency ?? "INR",
        receipt: data.receipt ?? `rcpt_${Date.now()}`,
        notes: { user_id: context.userId, ...(data.notes ?? {}) },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[razorpay] create order failed", res.status, body);
      throw new Error(body?.error?.description ?? `Razorpay error (${res.status})`);
    }
    return {
      order_id: body.id as string,
      amount: body.amount as number,
      currency: body.currency as string,
      key_id: process.env.RAZORPAY_KEY_ID!,
    };
  });

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
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan?: string;
  }) => {
    if (!d.razorpay_order_id || !d.razorpay_payment_id || !d.razorpay_signature) {
      throw new Error("Missing payment fields");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new Error("Razorpay not configured");

    const expected = await hmacSha256Hex(secret, `${data.razorpay_order_id}|${data.razorpay_payment_id}`);
    if (!timingSafeEqualHex(expected, data.razorpay_signature)) {
      throw new Error("Signature verification failed");
    }

    // Record subscription server-side (bypass RLS via service role).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("subscriptions").insert({
        user_id: context.userId,
        stripe_subscription_id: data.razorpay_payment_id,
        stripe_customer_id: data.razorpay_order_id,
        product_id: data.plan ?? "pro",
        price_id: "razorpay",
        status: "active",
        environment: (process.env.RAZORPAY_KEY_ID ?? "").startsWith("rzp_live") ? "live" : "test",
      } as never);
    } catch (e) {
      console.error("[razorpay] subscription insert failed", e);
    }

    return { ok: true, payment_id: data.razorpay_payment_id };
  });
