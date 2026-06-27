import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type PlanRole = "pro" | "team";
const WELCOME_BONUS_CREDITS = 50;

const CREDIT_PACKS: Record<string, number> = {
  credits_small_onetime: 100,
  credits_medium_onetime: 500,
  credits_large_onetime: 1500,
};

async function handleCheckoutCompleted(event: any, env: StripeEnv) {
  const session = event.data.object;
  if (session.mode !== "payment") return;
  const userId = session.metadata?.userId;
  if (!userId) return;
  const supabase = await getSupabase();

  // Idempotency: skip if we've already credited this session.
  const { data: dup } = await supabase
    .from("admin_notifications")
    .select("id")
    .eq("kind", "credit_pack_purchased")
    .contains("payload", { session_id: session.id })
    .maybeSingle();
  if (dup) return;

  // Resolve the price's lookup_key via the gateway to identify the pack.
  const { createStripeClient } = await import("@/lib/stripe.server");
  const stripe = createStripeClient(env);
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const lookupKey = lineItems.data[0]?.price?.lookup_key
    ?? lineItems.data[0]?.price?.metadata?.lovable_external_id
    ?? "";
  const credits = CREDIT_PACKS[lookupKey];
  if (!credits) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("bonus_credits, email, display_name")
    .eq("id", userId)
    .maybeSingle();
  await supabase
    .from("profiles")
    .update({ bonus_credits: (profile?.bonus_credits ?? 0) + credits })
    .eq("id", userId);

  await notifyAdmin(supabase, "credit_pack_purchased", userId, {
    session_id: session.id,
    price_id: lookupKey,
    credits_granted: credits,
    amount_total: session.amount_total,
    currency: session.currency,
    email: profile?.email,
    environment: env,
  });
}

function planRoleFromPriceId(priceId?: string | null): PlanRole {
  if (priceId && priceId.startsWith("team_")) return "team";
  return "pro";
}

async function setPlanRole(supabase: any, userId: string, role: PlanRole) {
  // Add the new role and remove the opposite one so plan switches stick.
  const other: PlanRole = role === "pro" ? "team" : "pro";
  await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", other);
}

async function removePlanRoles(supabase: any, userId: string) {
  await supabase
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .in("role", ["pro", "team"]);
}

async function notifyAdmin(supabase: any, kind: string, userId: string | null, payload: Record<string, unknown>) {
  await supabase.from("admin_notifications").insert({ kind, user_id: userId, payload });
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
  const role = planRoleFromPriceId(priceId);

  // Detect first-time activation for this subscription id.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status, price_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();

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

  const periodEndMs = periodEnd ? periodEnd * 1000 : null;
  const isActiveNow =
    sub.status === "active" ||
    sub.status === "trialing" ||
    sub.status === "past_due" ||
    (sub.status === "canceled" && periodEndMs && periodEndMs > Date.now());

  if (isActiveNow) {
    await setPlanRole(supabase, userId, role);
  } else {
    await removePlanRoles(supabase, userId);
  }

  const firstActivation =
    !existing && (sub.status === "active" || sub.status === "trialing");

  if (firstActivation) {
    // Seed welcome bonus credits (only on first activation).
    const { data: profile } = await supabase
      .from("profiles")
      .select("bonus_credits, email, display_name")
      .eq("id", userId)
      .maybeSingle();
    await supabase
      .from("profiles")
      .update({ bonus_credits: (profile?.bonus_credits ?? 0) + WELCOME_BONUS_CREDITS })
      .eq("id", userId);

    await notifyAdmin(supabase, "subscription_activated", userId, {
      plan: role,
      price_id: priceId,
      environment: env,
      email: profile?.email,
      display_name: profile?.display_name,
      bonus_credits_granted: WELCOME_BONUS_CREDITS,
    });

    // Queue a welcome email entry. Wired up to Lovable Emails once a domain
    // is configured; until then the row serves as an audit trail.
    await supabase.from("admin_notifications").insert({
      kind: "welcome_email_pending",
      user_id: userId,
      payload: { plan: role, email: profile?.email },
    });
  } else if (existing && existing.price_id !== priceId) {
    await notifyAdmin(supabase, "subscription_plan_changed", userId, {
      from: existing.price_id,
      to: priceId,
      environment: env,
    });
  } else if (sub.cancel_at_period_end && existing && !sub.canceled_at_was_set) {
    // Cancellation requested but grace period remains.
    await notifyAdmin(supabase, "subscription_cancel_scheduled", userId, {
      price_id: priceId,
      period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
    });
  }
}

async function handleSubscriptionDeleted(event: any, env: StripeEnv) {
  const sub = event.data.object;
  const supabase = await getSupabase();
  await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", sub.id)
    .eq("environment", env);
  const userId = sub.metadata?.userId;
  if (userId) {
    await removePlanRoles(supabase, userId);
    await notifyAdmin(supabase, "subscription_canceled", userId, {
      stripe_subscription_id: sub.id,
      environment: env,
    });
  }
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
