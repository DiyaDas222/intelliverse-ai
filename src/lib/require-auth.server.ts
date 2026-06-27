import { createClient } from "@supabase/supabase-js";

/**
 * Validate the Bearer token on an incoming Request.
 * Returns { userId } on success, or a Response (401) to return directly.
 */
export async function requireUser(
  request: Request,
): Promise<{ userId: string; token: string } | Response> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return new Response("Unauthorized", { status: 401 });
  return { userId: data.user.id, token };
}
