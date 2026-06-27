import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/upgrade/return")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: ReturnPage,
});

function ReturnPage() {
  const { session_id } = Route.useSearch();
  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="max-w-md rounded-2xl border bg-card/40 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Welcome to Pro</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your subscription is processing. Pro features unlock as soon as the payment is confirmed (usually a few seconds).
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-3 py-1 text-xs font-medium text-white">
          <ShieldCheck className="h-3 w-3" /> Pro Verified
        </div>
        {session_id && <p className="mt-2 text-[10px] text-muted-foreground">Session {session_id.slice(0, 12)}…</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link to="/studio">Go to Studio</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/studio/vibe">Try Vibe Coding</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
