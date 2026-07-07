import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookSignature } from "@/lib/razorpay.server";
import { CREDIT_PACKS } from "@/lib/razorpay.functions";

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const signature = request.headers.get("x-razorpay-signature");
          const raw = await request.text();
          if (!signature || !verifyWebhookSignature(raw, signature)) {
            return new Response("Invalid signature", { status: 401 });
          }
          const event = JSON.parse(raw);
          if (event.event !== "payment.captured") {
            return Response.json({ received: true });
          }
          const payment = event.payload?.payment?.entity;
          const notes = payment?.notes ?? {};
          const userId: string | undefined = notes.userId;
          const packId: string | undefined = notes.packId;
          if (!userId || !packId) return Response.json({ received: true, ignored: "missing notes" });
          const pack = CREDIT_PACKS[packId];
          if (!pack) return Response.json({ received: true, ignored: "unknown pack" });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Idempotency: skip if already credited (by payment id).
          const { data: dup } = await supabaseAdmin
            .from("admin_notifications")
            .select("id")
            .eq("kind", "razorpay_credit_pack_purchased")
            .contains("payload", { payment_id: payment.id })
            .maybeSingle();
          if (dup) return Response.json({ received: true, duplicate: true });

          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("bonus_credits, email")
            .eq("id", userId)
            .maybeSingle();
          await supabaseAdmin
            .from("profiles")
            .update({ bonus_credits: (profile?.bonus_credits ?? 0) + pack.credits })
            .eq("id", userId);
          await supabaseAdmin.from("admin_notifications").insert({
            kind: "razorpay_credit_pack_purchased",
            user_id: userId,
            payload: {
              payment_id: payment.id,
              order_id: payment.order_id,
              pack_id: packId,
              credits_granted: pack.credits,
              amount: payment.amount,
              currency: payment.currency,
              email: profile?.email,
              source: "webhook",
            },
          });
          return Response.json({ received: true });
        } catch (e) {
          console.error("Razorpay webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
