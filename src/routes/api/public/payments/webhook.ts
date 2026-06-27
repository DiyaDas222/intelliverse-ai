import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function ensureProRole(supabase: any, userId: string) {
  await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "pro" }, { onConflict: "user_id,role" });
}

async function removeProRole(supabase: any, userId: string) {
  await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "pro");
}

async function handleSubscription(event: any, env: StripeEnv) {
  const sub = event.data.object;
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }
  const supabase = await getSupabase();
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.lookup_key || item?.price?.metadata?.lovable_external_id || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const periodEnd = item?.current_period_end ?? sub.current_period_end;

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      product_id: productId,
      price_id: priceId,
      status: sub.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  const isActive =
    sub.status === "active" || sub.status === "trialing" ||
    (sub.status === "canceled" && periodEnd && periodEnd * 1000 > Date.now());

  if (isActive) await ensureProRole(supabase, userId);
  else await removeProRole(supabase, userId);
}

async function handleSubscriptionDeleted(event: any, env: StripeEnv) {
  const sub = event.data.object;
  const supabase = await getSupabase();
  await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  if (sub.metadata?.userId) await removeProRole(supabase, sub.metadata.userId);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          switch (event.type) {
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await handleSubscription(event, env);
              break;
            case "customer.subscription.deleted":
              await handleSubscriptionDeleted(event, env);
              break;
            default:
              console.log("Unhandled event:", event.type);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
