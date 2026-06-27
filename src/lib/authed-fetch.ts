import { supabase } from "@/integrations/supabase/client";

/**
 * fetch() wrapper that automatically attaches the current Supabase
 * access token as a Bearer Authorization header. Use for calls to
 * our own /api/* endpoints that require authentication.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers ?? {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
