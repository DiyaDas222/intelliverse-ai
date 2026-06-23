import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssetKind =
  | "image"
  | "audio"
  | "presentation"
  | "assignment"
  | "project"
  | "document"
  | "website"
  | "app"
  | "video";

export type AssetRow = {
  id: string;
  kind: AssetKind;
  title: string;
  prompt: string | null;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  metadata: Record<string, any>;
  created_at: string;
};

export const listAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind?: AssetKind | "all"; search?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<AssetRow[]> => {
    let q = context.supabase
      .from("generated_assets")
      .select("id,kind,title,prompt,storage_path,public_url,mime_type,size_bytes,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AssetRow[];
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("generated_assets")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.storage_path) {
      await context.supabase.storage.from("generations").remove([row.storage_path]);
    }
    const { error } = await context.supabase
      .from("generated_assets")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signAssetUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("generated_assets")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row?.storage_path) throw new Error("Asset not found");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("generations")
      .createSignedUrl(row.storage_path, 3600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

// Save an image (base64) generated client-side from the image stream.
export const saveImageAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string; b64: string; title?: string }) => d)
  .handler(async ({ data, context }) => {
    const bytes = Uint8Array.from(atob(data.b64), (c) => c.charCodeAt(0));
    const path = `${context.userId}/images/${crypto.randomUUID()}.png`;
    const { error: upErr } = await context.supabase.storage
      .from("generations")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const title = data.title?.trim() || data.prompt.slice(0, 60);
    const { data: row, error } = await context.supabase
      .from("generated_assets")
      .insert({
        user_id: context.userId,
        kind: "image",
        title,
        prompt: data.prompt,
        storage_path: path,
        mime_type: "image/png",
        size_bytes: bytes.byteLength,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveDocAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      kind: "presentation" | "assignment" | "project";
      title: string;
      prompt: string;
      content: any;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("generated_assets")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: data.title,
        prompt: data.prompt,
        metadata: { content: data.content },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
