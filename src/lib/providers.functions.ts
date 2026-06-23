import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProviderRow, ProviderStatus } from "./providers";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listProviderStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderStatus[]> => {
    const { data, error } = await context.supabase
      .from("provider_configs")
      .select("*")
      .order("category")
      .order("name");
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const r = row as ProviderRow;
      const missing = r.env_vars.filter((k) => !process.env[k]);
      return { ...r, configured: missing.length === 0, missing };
    });
  });

export const toggleProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("provider_configs")
      .update({
        enabled: data.enabled,
        notes: data.notes ?? undefined,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
