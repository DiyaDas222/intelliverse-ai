import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Credit packs (single source of truth, mirrored by the webhook).
export const CREDIT_PACKS: Record<string, { credits: number; amount: number; currency: string; label: string }> = {
  credits_small_onetime: { credits: 100, amount: 500, currency: "USD", label: "100 credits" },
  credits_medium_onetime: { credits: 500, amount: 2000, currency: "USD", label: "500 credits" },
  credits_large_onetime: { credits: 1500, amount: 5000, currency: "USD", label: "1500 credits" },
};

type CreateOrderResult =
  | { orderId: string; amount: number; currency: string; keyId: string; packId: string; credits: number }
  | { error: string };

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { packId: string }) => {
    if (!data?.packId || !/^[a-zA-Z0-9_]+$/.test(data.packId)) throw new Error("Invalid packId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CreateOrderResult> => {
    try {
      const pack = CREDIT_PACKS[data.packId];
      if (!pack) return { error: "Unknown credit pack" };
      const { razorpayCreateOrder, getRazorpayKeyId } = await import("./razorpay.server");
      const order = await razorpayCreateOrder({
        amount: pack.amount,
        currency: pack.currency,
        receipt: `iv_${context.userId.slice(0, 8)}_${Date.now()}`,
        notes: { userId: context.userId, packId: data.packId, credits: String(pack.credits) },
      });
      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: getRazorpayKeyId(),
        packId: data.packId,
        credits: pack.credits,
      };
    } catch (e: any) {
      return { error: e?.message ?? "Failed to create order" };
    }
  });

type VerifyResult = { ok: true; credits: number } | { error: string };

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { orderId: string; paymentId: string; signature: string; packId: string }) => {
    if (!data.orderId || !data.paymentId || !data.signature || !data.packId) throw new Error("Missing fields");
    return data;
  })
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    try {
      const pack = CREDIT_PACKS[data.packId];
      if (!pack) return { error: "Unknown credit pack" };
      const { verifyPaymentSignature } = await import("./razorpay.server");
      const valid = verifyPaymentSignature({
        orderId: data.orderId,
        paymentId: data.paymentId,
        signature: data.signature,
      });
      if (!valid) return { error: "Invalid payment signature" };

      // Credit the user's account (idempotent via payment_id check in admin_notifications).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: dup } = await supabaseAdmin
        .from("admin_notifications")
        .select("id")
        .eq("kind", "razorpay_credit_pack_purchased")
        .contains("payload", { payment_id: data.paymentId })
        .maybeSingle();
      if (dup) return { ok: true, credits: pack.credits };

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("bonus_credits, email")
        .eq("id", context.userId)
        .maybeSingle();
      await supabaseAdmin
        .from("profiles")
        .update({ bonus_credits: (profile?.bonus_credits ?? 0) + pack.credits })
        .eq("id", context.userId);
      await supabaseAdmin.from("admin_notifications").insert({
        kind: "razorpay_credit_pack_purchased",
        user_id: context.userId,
        payload: {
          payment_id: data.paymentId,
          order_id: data.orderId,
          pack_id: data.packId,
          credits_granted: pack.credits,
          amount: pack.amount,
          currency: pack.currency,
          email: profile?.email,
        },
      });
      return { ok: true, credits: pack.credits };
    } catch (e: any) {
      return { error: e?.message ?? "Verification failed" };
    }
  });
