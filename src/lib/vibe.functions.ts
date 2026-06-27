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
export type DeployStatus = "idle" | "deploying" | "deployed" | "failed";
export type DeployLogEntry = { at: string; level: "info" | "warn" | "error"; message: string };

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
  slug: string | null;
  deploy_status: DeployStatus;
  deployed_at: string | null;
  deploy_logs: DeployLogEntry[];
  version: number;
  created_at: string;
  updated_at: string;
};

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "site"
  );
}

function randSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

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
    const base = slugify(data.name);
    const slug = `${base}-${randSuffix()}`;
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
        slug,
      } as never)
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
      .update(patch as never)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as VibeProject;
  });

export const deployVibeProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; logs?: DeployLogEntry[] }) => d)
  .handler(async ({ data, context }): Promise<VibeProject> => {
    // Ensure the project belongs to caller & has files
    const { data: cur, error: getErr } = await context.supabase
      .from("vibe_projects")
      .select("id,files,slug,version,name")
      .eq("id", data.id)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!cur) throw new Error("Project not found");
    const curAny = cur as unknown as { files: VibeFile[]; slug: string | null; version: number; name: string };
    const files = curAny.files ?? [];
    if (files.length === 0) throw new Error("Nothing to deploy — generate files first");

    let slug = curAny.slug;
    if (!slug) {
      slug = `${slugify(curAny.name || "site")}-${randSuffix()}`;
    }

    const logs: DeployLogEntry[] = (data.logs ?? []).slice(-50);
    const patch = {
      slug,
      deploy_status: "deployed" as const,
      deployed_at: new Date().toISOString(),
      version: ((cur as { version: number }).version ?? 0) + 1,
      deploy_logs: logs,
    };

    const { data: row, error } = await context.supabase
      .from("vibe_projects")
      .update(patch as never)
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
