// Server-only entitlement + usage-guard helpers.
// Do not import from client code.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type UsageKind = "chat" | "generation" | "vibe";

/** Default free-tier caps per calendar month (UTC). null = unlimited. */
export const FREE_LIMITS: Record<UsageKind, number | null> = {
  chat: 100,
  generation: 15,
  vibe: 3,
};

export type GuardResult =
  | { ok: true; isPro: boolean; count: number; limit: number | null }
  | { ok: false; status: 402 | 401; body: { error: string; kind?: UsageKind; count?: number; limit?: number | null; upgrade_url?: string } };

function userSupabase(bearer: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

/**
 * Extracts the bearer from the request, then calls the increment_usage RPC.
 * The RPC uses auth.uid() internally so users can only touch their own counter.
 * Returns an "ok: false" response the caller should return directly on 401/402.
 */
export async function guardUsage(request: Request, kind: UsageKind): Promise<GuardResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, body: { error: "Sign in required" } };
  }
  const token = authHeader.slice(7);
  const supa = userSupabase(token);
  const limit = FREE_LIMITS[kind];
  const { data, error } = await supa.rpc("increment_usage", {
    _kind: kind,
    _free_limit: (limit ?? null) as unknown as number,
  });
  if (error) {
    console.error("[guardUsage] rpc error", error);
    return { ok: false, status: 401, body: { error: "Auth check failed" } };
  }
  const result = data as { allowed: boolean; is_pro?: boolean; count?: number; limit?: number | null; error?: string };
  if (!result.allowed) {
    if (result.error === "unauthenticated") {
      return { ok: false, status: 401, body: { error: "Sign in required" } };
    }
    return {
      ok: false,
      status: 402,
      body: {
        error: `You've hit the free ${kind} limit for this month (${result.count}/${result.limit}). Upgrade to Pro for unlimited access.`,
        kind,
        count: result.count,
        limit: result.limit,
        upgrade_url: "/upgrade",
      },
    };
  }
  return { ok: true, isPro: !!result.is_pro, count: result.count ?? 0, limit: result.limit ?? null };
}

/** Convenience: return a Response for a guard failure. */
export function guardResponse(guard: Extract<GuardResult, { ok: false }>): Response {
  return new Response(JSON.stringify(guard.body), {
    status: guard.status,
    headers: { "content-type": "application/json" },
  });
}
