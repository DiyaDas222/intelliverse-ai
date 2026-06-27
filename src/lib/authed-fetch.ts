import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let cachedAccessToken: string | null = null;
let cachedExpiresAt = 0;

export function setAuthedFetchSession(session: { access_token?: string; expires_at?: number } | null) {
  cachedAccessToken = session?.access_token ?? null;
  cachedExpiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
}

async function getAccessToken(): Promise<string | null> {
  // Avoid an auth round-trip on every chat/command request. The auth provider
  // keeps this cache fresh whenever the session changes.
  if (cachedAccessToken && cachedExpiresAt - Date.now() > 60_000) return cachedAccessToken;
  const { data } = await supabase.auth.getSession();
  setAuthedFetchSession(data.session);
  return data.session?.access_token ?? null;
}

/**
 * fetch() wrapper that automatically attaches the current Supabase
 * access token as a Bearer Authorization header. Use for calls to
 * our own /api/* endpoints that require authentication.
 *
 * Also surfaces 402 (Out of credits) responses globally as a toast
 * with an upgrade link, so individual callers don't have to handle it.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers ?? {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 402) {
    try {
      // Clone so the caller can still read the body.
      const cloned = res.clone();
      const body = (await cloned.json().catch(() => null)) as
        | { error?: string; upgradeUrl?: string }
        | null;
      toast.error(body?.error ?? "Out of credits", {
        action: {
          label: "Upgrade",
          onClick: () => {
            window.location.href = body?.upgradeUrl ?? "/upgrade";
          },
        },
      });
    } catch {
      /* ignore */
    }
  }
  return res;
}

