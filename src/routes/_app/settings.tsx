import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, User as UserIcon, Palette, Cpu } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CHAT_MODELS, DEFAULT_MODEL, isValidModel } from "@/lib/models";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — IntelliVerse" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [defaultModel, setDefaultModel] = useState<string>(DEFAULT_MODEL);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, email")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = (localStorage.getItem("iv:theme") as "dark" | "light" | "system" | null) ?? "dark";
    setTheme(t);
    const m = localStorage.getItem("iv:model");
    if (isValidModel(m)) setDefaultModel(m);
  }, []);

  const applyTheme = (next: "dark" | "light" | "system") => {
    setTheme(next);
    localStorage.setItem("iv:theme", next);
    const root = document.documentElement;
    const isDark =
      next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
    toast.success("Theme updated");
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, avatar_url: avatarUrl })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile", user.id] });
    }
  };

  const saveModel = (id: string) => {
    setDefaultModel(id);
    localStorage.setItem("iv:model", id);
    toast.success("Default model updated");
  };

  if (isLoading || !user) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, theme, and AI preferences.</p>

        {/* Profile */}
        <section className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <UserIcon className="h-4 w-4 text-accent" /> Profile
          </h2>

          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent text-base font-semibold text-primary-foreground">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                (displayName || user.email || "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium">{displayName || "Unnamed"}</div>
              <div className="truncate text-muted-foreground">{user.email}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Avatar URL</label>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <button
            onClick={saveProfile}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </button>
        </section>

        {/* Appearance */}
        <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-accent" /> Appearance
          </h2>
          <div className="flex flex-wrap gap-2">
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => applyTheme(t)}
                className={`rounded-full border px-4 py-1.5 text-xs capitalize transition ${
                  theme === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Default AI model */}
        <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Cpu className="h-4 w-4 text-accent" /> Default AI model
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHAT_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => saveModel(m.id)}
                className={`rounded-xl border p-3 text-left text-sm transition ${
                  defaultModel === m.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-muted-foreground">{m.hint}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Account */}
        <section className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
          <h2 className="mb-3 text-sm font-semibold">Account</h2>
          <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
          <button
            onClick={() => signOut()}
            className="mt-3 rounded-lg border border-border px-4 py-2 text-sm hover:bg-card"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
