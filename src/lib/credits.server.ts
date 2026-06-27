// Server-only credit metering. Uses the service role to call private.consume_credits.
// Returns null on success, or a Response (HTTP 402) to return directly from the handler.

let _admin: ReturnType<typeof makeAdmin> | null = null;
function makeAdmin() {
  // Lazy import: keep service-role module out of client bundles.
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function admin() {
  if (!_admin) _admin = makeAdmin();
  return _admin!;
}

export type CreditCheck =
  | { ok: true; remaining: number; allowance: number; used: number; bonus: number }
  | { ok: false; remaining: number; allowance: number; used: number; bonus: number };

/** Deduct `amount` credits from the user. Returns null on success, Response(402) on failure. */
export async function consumeCreditsOrReject(
  userId: string,
  amount: number,
): Promise<Response | null> {
  try {
    const { data, error } = await admin().rpc("consume_credits", {
      _user_id: userId,
      _amount: amount,
    } as any, { get: false }).schema?.("private") as any /* fall-through */;
    void data; void error;
  } catch { /* fall through to direct call below */ }

  // The supabase-js client does not expose a typed `private` schema; call via raw fetch.
  const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/consume_credits`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Profile": "private",
      "Content-Profile": "private",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    },
    body: JSON.stringify({ _user_id: userId, _amount: amount }),
  });
  if (!res.ok) {
    // Fail open with a logged warning rather than blocking a paying user on infra blip.
    console.error("consume_credits rpc failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const result = (await res.json()) as CreditCheck;
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
