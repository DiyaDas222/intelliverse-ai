import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const { data: { user } } = await context.supabase.auth.getUser();
      const customerId = await resolveOrCreateCustomer(stripe, {
        email: user?.email ?? undefined,
        userId: context.userId,
      });

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page" as any,
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId: context.userId },
        ...(isRecurring && {
          subscription_data: { metadata: { userId: context.userId } },
        }),
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type PortalSessionResult = { url: string } | { error: string };

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { returnUrl?: string; environment: StripeEnv }) => d)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { data: sub, error: subErr } = await context.supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subErr || !sub?.stripe_customer_id) return { error: "No subscription found" };
    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

type ChangePlanResult = { ok: true } | { error: string };

export const changeSubscriptionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { newPriceId: string; environment: StripeEnv }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(d.newPriceId)) throw new Error("Invalid priceId");
    return d;
  })
  .handler(async ({ data, context }): Promise<ChangePlanResult> => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("stripe_subscription_id, price_id")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !sub?.stripe_subscription_id) return { error: "No active subscription found" };
    if (sub.price_id === data.newPriceId) return { error: "You are already on this plan" };

    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.newPriceId] });
      if (!prices.data.length) return { error: "Target price not found" };
      const newPrice = prices.data[0];

      const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id as string);
      const itemId = current.items.data[0]?.id;
      if (!itemId) return { error: "Subscription item missing" };

      await stripe.subscriptions.update(sub.stripe_subscription_id as string, {
        items: [{ id: itemId, price: newPrice.id }],
        proration_behavior: "always_invoice",
        metadata: { userId: context.userId },
      });
      return { ok: true };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

type CurrentPlanResult =
  | { subscribed: false }
  | { subscribed: true; priceId: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null };

export const getCurrentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: StripeEnv }) => d)
  .handler(async ({ data, context }): Promise<CurrentPlanResult> => {
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("price_id, status, cancel_at_period_end, current_period_end")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub || !sub.price_id) return { subscribed: false };
    return {
      subscribed: true,
      priceId: sub.price_id as string,
      status: sub.status as string,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
    };
  });
