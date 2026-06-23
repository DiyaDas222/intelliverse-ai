import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Shield,
  Users,
  Activity,
  Loader2,
  Crown,
  UserMinus,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  checkIsAdmin,
  bootstrapFirstAdmin,
  listAdminUsers,
  setUserRole,
  listActivityLogs,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin — IntelliVerse" }] }),
  component: AdminPage,
});

type Tab = "users" | "roles" | "activity";

function AdminPage() {
  const checkFn = useServerFn(checkIsAdmin);
  const bootstrapFn = useServerFn(bootstrapFirstAdmin);
  const qc = useQueryClient();

  const { data: adminCheck, isLoading: checkingAdmin } = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => checkFn(),
  });

  const bootstrap = useMutation({
    mutationFn: () => bootstrapFn(),
    onSuccess: () => {
      toast.success("You are now the admin");
      qc.invalidateQueries({ queryKey: ["isAdmin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (checkingAdmin) {
    return (
      <div className="grid h-full place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!adminCheck?.isAdmin) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don't have admin privileges. If no admin exists yet, you can claim
            the first admin seat.
          </p>
          <button
            onClick={() => bootstrap.mutate()}
            disabled={bootstrap.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {bootstrap.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crown className="h-4 w-4" />
            )}
            Claim first admin
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-border/60 px-6 py-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-semibold">Admin dashboard</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, roles, and review activity across IntelliVerse.
        </p>

        <nav className="mt-4 flex gap-1 border-b border-border/60 -mb-4">
          {(
            [
              { id: "users", label: "Users", icon: Users },
              { id: "roles", label: "Role status", icon: Crown },
              { id: "activity", label: "Activity logs", icon: Activity },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "users" && <UsersTab />}
        {tab === "roles" && <RolesTab />}
        {tab === "activity" && <ActivityTab />}
      </div>
    </div>
  );
}

function UsersTab() {
  const listFn = useServerFn(listAdminUsers);
  const setRoleFn = useServerFn(setUserRole);
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: () => listFn(),
  });

  const toggleAdmin = useMutation({
    mutationFn: (v: { userId: string; grant: boolean }) =>
      setRoleFn({ data: { userId: v.userId, role: "admin", grant: v.grant } }),
    onSuccess: (_d, v) => {
      toast.success(v.grant ? "Admin granted" : "Admin revoked");
      qc.invalidateQueries({ queryKey: ["adminUsers"] });
      qc.invalidateQueries({ queryKey: ["activityLogs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Users</h2>
          <p className="text-xs text-muted-foreground">{users.length} total</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Roles</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Last seen</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <tr key={u.id} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">
                        {(u.email ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{u.display_name ?? u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                          <Crown className="h-3 w-3" /> admin
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        user
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() =>
                        toggleAdmin.mutate({ userId: u.id, grant: !isAdmin })
                      }
                      disabled={toggleAdmin.isPending}
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        isAdmin
                          ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                          : "border-border hover:bg-muted"
                      } disabled:opacity-50`}
                    >
                      {isAdmin ? (
                        <>
                          <UserMinus className="h-3 w-3" /> Revoke admin
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3 w-3" /> Make admin
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RolesTab() {
  const listFn = useServerFn(listAdminUsers);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["adminUsers"],
    queryFn: () => listFn(),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const admins = users.filter((u) => u.roles.includes("admin"));
  const regular = users.filter((u) => !u.roles.includes("admin"));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard label="Total users" value={users.length} icon={Users} />
      <StatCard label="Admins" value={admins.length} icon={Crown} accent />
      <StatCard label="Standard users" value={regular.length} icon={Users} />

      <div className="md:col-span-3 rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Crown className="h-4 w-4 text-accent" /> Admin role
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Full control: manage users, assign roles, view all activity, delete data.
        </p>
        <ul className="mt-3 space-y-1">
          {admins.map((u) => (
            <li key={u.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span>{u.display_name ?? u.email}</span>
              <span className="text-xs text-muted-foreground">{u.email}</span>
            </li>
          ))}
          {admins.length === 0 && (
            <li className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> No admins assigned
            </li>
          )}
        </ul>
      </div>

      <div className="md:col-span-3 rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" /> Standard user role
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Default for every signed-in user. Can chat, upload documents, and manage their own data only.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {regular.length} user{regular.length === 1 ? "" : "s"} hold this role.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${accent ? "text-accent" : "text-muted-foreground"}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ActivityTab() {
  const listFn = useServerFn(listActivityLogs);
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["activityLogs"],
    queryFn: () => listFn(),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <p className="text-xs text-muted-foreground">Latest {logs.length} events</p>
      </div>
      {logs.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {logs.map((l) => (
            <li key={l.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-muted">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {l.action}
                  </code>
                  <span className="text-xs text-muted-foreground">
                    {l.email ?? l.user_id ?? "system"}
                  </span>
                </div>
                {Object.keys(l.metadata).length > 0 && (
                  <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    {JSON.stringify(l.metadata, null, 2)}
                  </pre>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(l.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
