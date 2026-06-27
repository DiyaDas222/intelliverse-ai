import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CreditsSummary = {
  plan: "free" | "pro" | "team";
  allowance: number;
  used: number;
  bonus: number;
  remaining: number;
  periodStart: string | null;
};

export const getCreditsSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditsSummary> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("monthly_credits_used, credits_period_start, bonus_credits")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const list = (roles ?? []).map((r) => r.role as string);
    const plan: "free" | "pro" | "team" = list.includes("team")
      ? "team"
      : list.includes("pro")
        ? "pro"
        : "free";
    const allowance = plan === "team" ? 5000 : plan === "pro" ? 1000 : 25;
    const used = (profile?.monthly_credits_used as number | null) ?? 0;
    const bonus = (profile?.bonus_credits as number | null) ?? 0;
    return {
      plan,
      allowance,
      used,
      bonus,
      remaining: Math.max(0, allowance - used) + bonus,
      periodStart: (profile?.credits_period_start as string | null) ?? null,
    };
  });
