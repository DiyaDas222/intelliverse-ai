// Server-only credit metering. Calls the service-role wrapper public.consume_credits,
// which delegates to private.consume_credits. Returns null on success or a 402 Response on failure.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

type CreditResult = {
  ok: boolean;
  remaining: number;
  allowance?: number;
  used?: number;
  bonus?: number;
};

/** Deduct `amount` credits from the user. Returns null on success, Response(402) on failure. */
export async function consumeCreditsOrReject(
  userId: string,
  amount: number,
): Promise<Response | null> {
  if (!amount || amount <= 0) return null;
  try {
    const { data, error } = await admin().rpc("consume_credits", {
      _user_id: userId,
      _amount: amount,
    });
    if (error) {
      // Fail open on infra blip rather than blocking a paying user.
      console.error("consume_credits rpc failed", error.message);
      return null;
    }
    const result = data as CreditResult | null;
    if (!result?.ok) {
      return new Response(
        JSON.stringify({
          error: "Out of credits",
          upgradeUrl: "/upgrade",
          remaining: result?.remaining ?? 0,
          allowance: result?.allowance ?? 0,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }
    return null;
  } catch (e) {
    console.error("consume_credits threw", e);
    return null;
  }
}

/** Cost table per feature. Keep small + predictable. */
export const COST = {
  chat: 1,
  image: 3,
  doc: 2,
  code: 2,
  vibe: 2,
  music: 5,
  video: 5,
  tts: 5,
  transcribe: 5,
} as const;

/** Server fn-friendly: returns the balance snapshot without consuming. */
export async function getCreditSnapshot(userId: string) {
  const { data, error } = await admin()
    .from("profiles")
    .select("monthly_credits_used, credits_period_start, bonus_credits")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
