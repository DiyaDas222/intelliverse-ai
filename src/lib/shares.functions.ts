import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ShareRow = {
  id: string;
  token: string;
  asset_id: string;
  expires_at: string;
  max_views: number | null;
  view_count: number;
  allow_download: boolean;
  created_at: string;
};

function randomToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { assetId: string; expiresInHours: number; maxViews?: number | null; allowDownload?: boolean }) => d,
  )
  .handler(async ({ data, context }): Promise<ShareRow> => {
    // Verify ownership via RLS-scoped select
    const { data: asset, error: aErr } = await context.supabase
      .from("generated_assets")
      .select("id")
      .eq("id", data.assetId)
      .maybeSingle();
    if (aErr || !asset) throw new Error("Asset not found");

    const hours = Math.max(1, Math.min(24 * 365, data.expiresInHours));
    const expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();

    const { data: row, error } = await context.supabase
      .from("asset_shares")
      .insert({
        token: randomToken(),
        asset_id: data.assetId,
        user_id: context.userId,
        expires_at: expiresAt,
        max_views: data.maxViews ?? null,
        allow_download: data.allowDownload ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as ShareRow;
  });

export const listAssetShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assetId: string }) => d)
  .handler(async ({ data, context }): Promise<ShareRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("asset_shares")
      .select("*")
      .eq("asset_id", data.assetId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ShareRow[];
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("asset_shares").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
