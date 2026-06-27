import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VibeFile = { path: string; content: string };
export type VibeMessage = { role: "user" | "assistant"; content: string; at?: string };
export type VibeStack = {
  frontend?: string;
  backend?: string;
  database?: string;
  auth?: string;
  styling?: string;
  extras?: string[];
};
export type VibeProject = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  kind: string;
  stack: VibeStack;
  files: VibeFile[];
  messages: VibeMessage[];
  entry_file: string | null;
  created_at: string;
  updated_at: string;
};

export const listVibeProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VibeProject[]> => {
    const { data, error } = await context.supabase
      .from("vibe_projects")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as VibeProject[];
  });

export const getVibeProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }): Promise<VibeProject> => {
    const { data: row, error } = await context.supabase
      .from("vibe_projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found");
    return row as unknown as VibeProject;
  });

export const createVibeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    description?: string;
    kind?: string;
    stack?: VibeStack;
  }) => d)
  .handler(async ({ data, context }): Promise<VibeProject> => {
    const { data: row, error } = await context.supabase
      .from("vibe_projects")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        kind: data.kind ?? "website",
        stack: data.stack ?? {},
        files: [],
        messages: [],
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as VibeProject;
  });

export const updateVibeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    name?: string;
    description?: string;
    stack?: VibeStack;
    files?: VibeFile[];
    messages?: VibeMessage[];
    entry_file?: string | null;
  }) => d)
  .handler(async ({ data, context }): Promise<VibeProject> => {
    const patch: Record<string, unknown> = {};
    for (const k of ["name", "description", "stack", "files", "messages", "entry_file"] as const) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    const { data: row, error } = await context.supabase
      .from("vibe_projects")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as VibeProject;
  });

export const deleteVibeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vibe_projects")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
