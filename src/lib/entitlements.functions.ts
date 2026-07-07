import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price_paise: number;
  currency: string;
  duration_days: number;
  sort_order: number;
  features: string[];
};

export type Entitlements = {
  is_pro: boolean;
  plan: string; // 'free' | plan id
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  usage: Record<"chat" | "generation" | "vibe", number>;
  limits: Record<"chat" | "generation" | "vibe", number | null>;
  period_key: string;
};

const FREE_LIMITS = { chat: 100, generation: 15, vibe: 3 } as const;

export const listPlans = createServerFn({ method: "GET" }).handler(async (): Promise<PlanRow[]> => {
  const supa = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supa
    .from("plans")
    .select("id,name,description,price_paise,currency,duration_days,sort_order,features")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    ...p,
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
  }));
});

export const getEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlements> => {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)

    const [subRes, usageRes] = await Promise.all([
      context.supabase
        .from("subscriptions")
        .select("plan_id,status,current_period_end,cancel_at_period_end")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .order("current_period_end", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      context.supabase
        .from("usage_counters")
        .select("kind,count")
        .eq("user_id", context.userId)
        .eq("period_key", period),
    ]);

    const sub = subRes.data;
    const now = Date.now();
    const validSub = sub && (!sub.current_period_end || new Date(sub.current_period_end).getTime() > now);
    const usage = { chat: 0, generation: 0, vibe: 0 };
    for (const row of usageRes.data ?? []) {
      if (row.kind in usage) usage[row.kind as keyof typeof usage] = row.count ?? 0;
    }

    return {
      is_pro: !!validSub,
      plan: validSub && sub?.plan_id ? sub.plan_id : "free",
      status: sub?.status ?? null,
      current_period_end: sub?.current_period_end ?? null,
      cancel_at_period_end: sub?.cancel_at_period_end ?? false,
      usage,
      limits: validSub ? { chat: null, generation: null, vibe: null } : { ...FREE_LIMITS },
      period_key: period,
    };
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payments")
      .select("id,plan_id,amount_paise,currency,status,environment,razorpay_payment_id,razorpay_order_id,captured_at,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // One-shot orders: mark cancel_at_period_end so user stays Pro until expiry
    // but nothing auto-renews (nothing auto-renews here anyway).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: true } as never)
      .eq("user_id", context.userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reactivateSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ cancel_at_period_end: false } as never)
      .eq("user_id", context.userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
