import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GH = "https://api.github.com";
const BRAND = "IntelliVerse AI";

export type GithubConnection = {
  github_username: string;
  token_type: string;
  scopes: string[] | null;
  connected_at: string;
};

export type PublishFile = { path: string; content: string };

export type PublishHistoryRow = {
  id: string;
  repo_owner: string;
  repo_name: string;
  branch: string;
  is_private: boolean;
  commit_sha: string | null;
  repo_url: string;
  file_count: number;
  status: string;
  error: string | null;
  pro_at_publish: boolean;
  source_kind: string;
  source_id: string | null;
  created_at: string;
};

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "IntelliVerse-AI",
  };
}

async function ghFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: { ...ghHeaders(token), "Content-Type": "application/json", ...(init.headers as any) },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = json?.message || `GitHub ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

// ===== Connection management =====

export const connectGithubPat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => {
    if (!d?.token || typeof d.token !== "string" || d.token.length < 20) {
      throw new Error("Invalid token");
    }
    return { token: d.token.trim() };
  })
  .handler(async ({ data, context }): Promise<GithubConnection> => {
    // Validate token + fetch user
    const me = await ghFetch("/user", data.token);
    const scopesHeader = await fetch(`${GH}/user`, { headers: ghHeaders(data.token) }).then((r) =>
      r.headers.get("x-oauth-scopes"),
    );
    const scopes = scopesHeader ? scopesHeader.split(",").map((s) => s.trim()).filter(Boolean) : [];

    if (scopes.length && !scopes.includes("repo") && !scopes.includes("public_repo")) {
      throw new Error("Token is missing the 'repo' (or 'public_repo') scope.");
    }

    const { error } = await context.supabase
      .from("github_connections")
      .upsert({
        user_id: context.userId,
        github_username: me.login,
        github_user_id: me.id,
        access_token: data.token,
        token_type: "pat",
        scopes,
      });
    if (error) throw new Error(error.message);

    return {
      github_username: me.login,
      token_type: "pat",
      scopes,
      connected_at: new Date().toISOString(),
    };
  });

export const getGithubConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GithubConnection | null> => {
    const { data, error } = await context.supabase
      .from("github_connections")
      .select("github_username, token_type, scopes, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      github_username: data.github_username,
      token_type: data.token_type,
      scopes: (data.scopes as string[] | null) ?? [],
      connected_at: data.created_at,
    };
  });

export const disconnectGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("github_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Pro detection =====

export const getProStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isPro: boolean }> => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "pro" as any)
      .maybeSingle();
    return { isPro: !!data };
  });

// ===== Repo existence check =====

export const checkRepoExists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { repo: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: conn } = await context.supabase
      .from("github_connections")
      .select("access_token, github_username")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn) throw new Error("GitHub not connected");
    try {
      const r = await ghFetch(`/repos/${conn.github_username}/${encodeURIComponent(data.repo)}`, conn.access_token);
      return { exists: true, url: r.html_url as string };
    } catch (e: any) {
      if (e.status === 404) return { exists: false };
      throw e;
    }
  });

// ===== Branding helpers =====

const COMMENT_LANGS: Record<string, "slash" | "hash" | "html" | "css"> = {
  js: "slash", mjs: "slash", cjs: "slash", jsx: "slash", ts: "slash", tsx: "slash",
  java: "slash", c: "slash", cpp: "slash", cs: "slash", go: "slash", rs: "slash",
  swift: "slash", kt: "slash", scala: "slash", php: "slash", dart: "slash",
  py: "hash", rb: "hash", sh: "hash", bash: "hash", zsh: "hash", yml: "hash", yaml: "hash", toml: "hash",
  html: "html", htm: "html", xml: "html", vue: "html", svelte: "html",
  css: "css", scss: "css", sass: "css", less: "css",
};

function brandComment(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const style = COMMENT_LANGS[ext];
  const text = `Generated with ${BRAND}. Upgrade to Pro to remove branding.`;
  if (!style) return null;
  if (style === "slash") return `// ${text}\n`;
  if (style === "hash") return `# ${text}\n`;
  if (style === "html") return `<!-- ${text} -->\n`;
  if (style === "css") return `/* ${text} */\n`;
  return null;
}

function applyFreeBranding(files: PublishFile[]): PublishFile[] {
  return files.map((f) => {
    const name = f.path.toLowerCase();
    if (name.endsWith("readme.md") || name === "readme.md") {
      const note = `\n\n---\n_Created using ${BRAND}._\n`;
      return { ...f, content: f.content.includes(`Created using ${BRAND}`) ? f.content : f.content + note };
    }
    if (name.endsWith(".html") || name.endsWith(".htm")) {
      const watermark = `\n<!-- Built with ${BRAND} -->\n<div style="position:fixed;bottom:8px;right:8px;font:11px system-ui;background:rgba(0,0,0,.7);color:#fff;padding:4px 8px;border-radius:6px;z-index:99999;opacity:.85">Built with ${BRAND}</div>\n`;
      if (f.content.includes("</body>")) {
        return { ...f, content: f.content.replace(/<\/body>/i, `${watermark}</body>`) };
      }
      return { ...f, content: f.content + watermark };
    }
    const c = brandComment(f.path);
    if (!c) return f;
    if (f.content.startsWith(c.trimEnd())) return f;
    return { ...f, content: c + f.content };
  });
}

function ensureReadme(files: PublishFile[], opts: { name: string; description: string; isPro: boolean }) {
  if (files.some((f) => f.path.toLowerCase() === "readme.md")) return files;
  const footer = opts.isPro ? "" : `\n\n---\n_Created using ${BRAND}._\n`;
  const readme = `# ${opts.name}\n\n${opts.description || "A project."}${footer}`;
  return [...files, { path: "README.md", content: readme }];
}

// ===== Publish =====

export const publishToGithub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    repoName: string;
    description?: string;
    isPrivate?: boolean;
    branch?: string;
    overwrite?: boolean;
    sourceKind: string;
    sourceId?: string;
    files: PublishFile[];
    commitMessage?: string;
  }) => {
    if (!d.repoName || !/^[A-Za-z0-9._-]{1,100}$/.test(d.repoName)) {
      throw new Error("Invalid repo name");
    }
    if (!Array.isArray(d.files) || d.files.length === 0) {
      throw new Error("No files to publish");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    // Load connection
    const { data: conn } = await context.supabase
      .from("github_connections")
      .select("access_token, github_username")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn) throw new Error("GitHub not connected. Connect your account first.");

    // Pro status
    const { data: isProRow } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "pro" as any,
    });
    const isPro = !!isProRow;

    const owner = conn.github_username;
    const token = conn.access_token;
    const repo = data.repoName;
    const branch = data.branch || "main";
    const isPrivate = data.isPrivate ?? true;

    // Branding
    let files = data.files;
    files = ensureReadme(files, {
      name: data.repoName,
      description: data.description || "",
      isPro,
    });
    if (!isPro) files = applyFreeBranding(files);

    // Check if repo exists
    let repoUrl: string | null = null;
    let repoExists = false;
    try {
      const r = await ghFetch(`/repos/${owner}/${encodeURIComponent(repo)}`, token);
      repoExists = true;
      repoUrl = r.html_url;
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }

    if (repoExists && !data.overwrite) {
      return { needsConfirmOverwrite: true, repoUrl } as const;
    }

    // Create repo if missing
    if (!repoExists) {
      const created = await ghFetch(`/user/repos`, token, {
        method: "POST",
        body: JSON.stringify({
          name: repo,
          description: data.description?.slice(0, 350) || `Built with ${BRAND}`,
          private: isPrivate,
          auto_init: true,
          default_branch: branch,
        }),
      });
      repoUrl = created.html_url;
    }

    // Resolve branch base SHA (use default branch's tip if branch doesn't exist)
    let baseSha: string | null = null;
    let branchExists = false;
    try {
      const ref = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, token);
      baseSha = ref.object.sha;
      branchExists = true;
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }

    if (!branchExists) {
      // Get repo to find default branch
      const repoInfo = await ghFetch(`/repos/${owner}/${repo}`, token);
      const defBranch = repoInfo.default_branch;
      try {
        const defRef = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${defBranch}`, token);
        baseSha = defRef.object.sha;
        // Create the new branch off default
        await ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
        });
      } catch (e: any) {
        // Empty repo (no commits yet) — we will create initial commit with no parent
        if (e.status !== 404 && e.status !== 409) throw e;
        baseSha = null;
      }
    }

    // Get base tree (if we have a base commit)
    let baseTreeSha: string | null = null;
    if (baseSha) {
      const baseCommit = await ghFetch(`/repos/${owner}/${repo}/git/commits/${baseSha}`, token);
      baseTreeSha = baseCommit.tree.sha;
    }

    // Create blobs for every file
    const treeEntries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string }> = [];
    for (const f of files) {
      const blob = await ghFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(f.content, "utf8").toString("base64"),
          encoding: "base64",
        }),
      });
      treeEntries.push({ path: f.path.replace(/^\/+/, ""), mode: "100644", type: "blob", sha: blob.sha });
    }

    // Create tree (overwrite mode wipes existing tree by NOT passing base_tree)
    const treeBody: any = { tree: treeEntries };
    if (baseTreeSha && !data.overwrite && !repoExists) treeBody.base_tree = baseTreeSha;
    const tree = await ghFetch(`/repos/${owner}/${repo}/git/trees`, token, {
      method: "POST",
      body: JSON.stringify(treeBody),
    });

    // Create commit
    const commitBody: any = {
      message: data.commitMessage || `Publish from ${BRAND}`,
      tree: tree.sha,
    };
    if (baseSha) commitBody.parents = [baseSha];
    const commit = await ghFetch(`/repos/${owner}/${repo}/git/commits`, token, {
      method: "POST",
      body: JSON.stringify(commitBody),
    });

    // Update / create ref
    if (branchExists || baseSha) {
      try {
        await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token, {
          method: "PATCH",
          body: JSON.stringify({ sha: commit.sha, force: true }),
        });
      } catch (e: any) {
        if (e.status === 422 || e.status === 404) {
          await ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
            method: "POST",
            body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
          });
        } else {
          throw e;
        }
      }
    } else {
      await ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
      });
    }

    const finalUrl = repoUrl || `https://github.com/${owner}/${repo}`;

    await context.supabase.from("publish_history").insert({
      user_id: context.userId,
      source_kind: data.sourceKind,
      source_id: data.sourceId ?? null,
      repo_owner: owner,
      repo_name: repo,
      branch,
      is_private: isPrivate,
      commit_sha: commit.sha,
      repo_url: finalUrl,
      file_count: files.length,
      status: "success",
      pro_at_publish: isPro,
    });

    return {
      ok: true,
      repoUrl: finalUrl,
      commitSha: commit.sha as string,
      branch,
      isPro,
      fileCount: files.length,
    } as const;
  });

export const listPublishHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { sourceKind?: string; sourceId?: string }) => d ?? {})
  .handler(async ({ data, context }): Promise<PublishHistoryRow[]> => {
    let q = context.supabase
      .from("publish_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.sourceKind) q = q.eq("source_kind", data.sourceKind);
    if (data.sourceId) q = q.eq("source_id", data.sourceId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as PublishHistoryRow[];
  });
