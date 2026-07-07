import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  MessageSquarePlus,
  MessageSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  Pin,
  Trash2,
  Search,
  Loader2,
  Shield,
  Menu,
  X,
  LayoutGrid,
  Settings as SettingsIcon,
  Wand2,
  LibraryBig,
  Plug,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getEntitlements } from "@/lib/entitlements.functions";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  updated_at: string;
};

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id,title,pinned,updated_at")
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["isAdminSidebar", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) return false;
      return !!data;
    },
  });

  const entFn = useServerFn(getEntitlements);
  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    enabled: !!user,
    queryFn: () => entFn(),
    staleTime: 60_000,
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase
        .from("conversations")
        .update({ pinned: !pinned })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });

  const deleteConv = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (location.pathname.includes(id)) navigate({ to: "/chat" });
      toast.success("Chat deleted");
    },
  });

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex min-h-screen bg-background md:grid md:grid-cols-[280px_1fr]">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/90 px-3 backdrop-blur md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md hover:bg-sidebar-accent"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-accent">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </span>
          IntelliVerse
        </Link>
        <Link
          to="/chat"
          className="grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br from-primary to-accent text-primary-foreground"
          aria-label="New chat"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Link>
      </div>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[85vw] max-w-[320px] flex-col border-r border-border/60 bg-sidebar transition-transform md:static md:h-screen md:w-auto md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-accent">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
            IntelliVerse
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pt-4">
          <Link
            to="/chat"
            className="flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </Link>
        </div>

        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="w-full rounded-md border border-border bg-background px-8 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>

        <nav className="mt-2 flex-1 overflow-y-auto px-2 pb-3 pt-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No chats yet — start one above.
            </p>
          )}
          {filtered.map((c) => {
            const active = location.pathname === `/chat/${c.id}`;
            return (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-md px-1 ${
                  active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"
                }`}
              >
                <Link
                  to="/chat/$id"
                  params={{ id: c.id }}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title}</span>
                  {c.pinned && <Pin className="ml-auto h-3 w-3 shrink-0 text-accent" />}
                </Link>
                <button
                  onClick={() => togglePin.mutate({ id: c.id, pinned: c.pinned })}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                  title={c.pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this chat?")) deleteConv.mutate(c.id);
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-2">
          <Link
            to="/dashboard"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
              location.pathname === "/dashboard" ? "bg-sidebar-accent" : ""
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            to="/studio"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
              location.pathname.startsWith("/studio") ? "bg-sidebar-accent" : ""
            }`}
          >
            <Wand2 className="h-4 w-4" />
            Creation Studio
          </Link>
          <Link
            to="/library"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
              location.pathname === "/library" ? "bg-sidebar-accent" : ""
            }`}
          >
            <LibraryBig className="h-4 w-4" />
            Library
          </Link>
          <Link
            to="/tools"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
              location.pathname.startsWith("/tools") ? "bg-sidebar-accent" : ""
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            AI Tools
          </Link>
          <Link
            to="/documents"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
              location.pathname === "/documents" ? "bg-sidebar-accent" : ""
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents
          </Link>
          <Link
            to="/settings"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
              location.pathname === "/settings" ? "bg-sidebar-accent" : ""
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Link>
          {isAdmin && (
            <>
              <Link
                to="/admin"
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
                  location.pathname === "/admin" ? "bg-sidebar-accent" : ""
                }`}
              >
                <Shield className="h-4 w-4 text-accent" />
                Admin
              </Link>
              <Link
                to="/providers"
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
                  location.pathname === "/providers" ? "bg-sidebar-accent" : ""
                }`}
              >
                <Plug className="h-4 w-4 text-accent" />
                Providers
              </Link>
            </>
          )}
          <div className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">
              {(user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 truncate text-xs">
              <div className="truncate text-foreground">{user.email}</div>
              {entitlements?.is_pro ? (
                <Link to="/settings/billing" className="inline-flex items-center gap-1 text-emerald-500 hover:underline">
                  <Sparkles className="h-3 w-3" /> {entitlements.plan}
                </Link>
              ) : (
                <Link to="/upgrade" className="text-muted-foreground hover:text-foreground hover:underline">
                  Free · Upgrade
                </Link>
              )}
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="h-[100dvh] min-w-0 flex-1 overflow-hidden pt-14 md:h-screen md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
