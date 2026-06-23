import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  FileText,
  Sparkles,
  TrendingUp,
  Clock,
  Pin,
  ArrowRight,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type ActivityPoint = { day: string; count: number };

function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      const sinceIso = since.toISOString();

      const [convsRes, msgsRes, docsRes, weekMsgsRes, recentConvsRes] =
        await Promise.all([
          supabase.from("conversations").select("id", { count: "exact", head: true }),
          supabase.from("messages").select("id", { count: "exact", head: true }),
          supabase.from("documents").select("id", { count: "exact", head: true }),
          supabase
            .from("messages")
            .select("created_at")
            .gte("created_at", sinceIso),
          supabase
            .from("conversations")
            .select("id,title,updated_at,pinned")
            .order("pinned", { ascending: false })
            .order("updated_at", { ascending: false })
            .limit(5),
        ]);

      // build 7-day activity
      const days: ActivityPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString(undefined, { weekday: "short" });
        const count =
          weekMsgsRes.data?.filter((m) => m.created_at?.slice(0, 10) === key)
            .length ?? 0;
        days.push({ day: label, count });
      }

      return {
        chats: convsRes.count ?? 0,
        messages: msgsRes.count ?? 0,
        documents: docsRes.count ?? 0,
        weekly: weekMsgsRes.data?.length ?? 0,
        activity: days,
        recent: recentConvsRes.data ?? [],
      };
    },
  });

  const maxCount = Math.max(1, ...(stats?.activity.map((a) => a.count) ?? [1]));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back
            {user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening across your AI workspace.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total chats"
            value={stats?.chats ?? 0}
            icon={MessageSquare}
            tint="from-primary/20 to-primary/5"
            loading={isLoading}
          />
          <StatCard
            label="Messages exchanged"
            value={stats?.messages ?? 0}
            icon={Zap}
            tint="from-accent/20 to-accent/5"
            loading={isLoading}
          />
          <StatCard
            label="Documents"
            value={stats?.documents ?? 0}
            icon={FileText}
            tint="from-emerald-500/20 to-emerald-500/5"
            loading={isLoading}
          />
          <StatCard
            label="This week"
            value={stats?.weekly ?? 0}
            icon={TrendingUp}
            tint="from-orange-500/20 to-orange-500/5"
            loading={isLoading}
          />
        </div>

        {/* Activity + Quick actions */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {/* Activity chart */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Weekly activity</h2>
                <p className="text-xs text-muted-foreground">
                  Messages sent over the last 7 days
                </p>
              </div>
              <TrendingUp className="h-4 w-4 text-accent" />
            </div>
            <div className="flex h-40 items-end gap-2">
              {stats?.activity.map((a, i) => (
                <div key={i} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-primary to-accent transition-all hover:opacity-80"
                      style={{
                        height: `${(a.count / maxCount) * 100}%`,
                        minHeight: a.count > 0 ? 6 : 2,
                      }}
                    />
                    <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-popover px-1.5 py-0.5 text-[10px] opacity-0 shadow group-hover:opacity-100">
                      {a.count}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{a.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold">Quick actions</h2>
            <div className="space-y-2">
              <QuickAction
                to="/chat"
                icon={Sparkles}
                title="Start a new chat"
                subtitle="Ask anything"
              />
              <QuickAction
                to="/documents"
                icon={FileText}
                title="Upload a document"
                subtitle="Chat with files"
              />
            </div>
          </div>
        </div>

        {/* Recent chats */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-card/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent chats</h2>
            <Link
              to="/chat"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              New chat <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {isLoading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Loading…</p>
          ) : stats?.recent.length === 0 ? (
            <div className="py-10 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">No chats yet</p>
              <Link
                to="/chat"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Start your first chat <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {stats?.recent.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/chat/$id"
                    params={{ id: c.id }}
                    className="flex items-center gap-3 py-3 hover:bg-sidebar-accent/40 -mx-2 px-2 rounded-md"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                      <MessageSquare className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-medium">{c.title}</p>
                        {c.pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
                      </div>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatRelative(c.updated_at)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className={`grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br ${tint}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">
        {loading ? <span className="text-muted-foreground">—</span> : value.toLocaleString()}
      </div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition-all hover:border-primary/50 hover:bg-background"
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent">
        <Icon className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
