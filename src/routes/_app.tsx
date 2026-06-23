import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  MessageSquarePlus,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  Pin,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

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
    <div className="grid min-h-screen grid-cols-[280px_1fr] bg-background">
      <aside className="flex h-screen flex-col border-r border-border/60 bg-sidebar">
        <div className="flex items-center justify-between px-4 pt-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-accent">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
            IntelliVerse
          </Link>
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
                  className="flex flex-1 items-center gap-2 truncate px-2 py-2 text-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.title}</span>
                  {c.pinned && <Pin className="ml-auto h-3 w-3 text-accent" />}
                </Link>
                <button
                  onClick={() => togglePin.mutate({ id: c.id, pinned: c.pinned })}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-foreground"
                  title={c.pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this chat?")) deleteConv.mutate(c.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive"
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
            to="/documents"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${
              location.pathname === "/documents" ? "bg-sidebar-accent" : ""
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents
          </Link>
          <div className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">
              {(user.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 truncate text-xs">
              <div className="truncate text-foreground">{user.email}</div>
              <div className="text-muted-foreground">Free plan</div>
            </div>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="h-screen overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
