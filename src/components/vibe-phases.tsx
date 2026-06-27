import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PhaseId =
  | "planning"
  | "ui"
  | "frontend"
  | "backend"
  | "database"
  | "auth"
  | "api"
  | "testing"
  | "building"
  | "deployment";

export const PHASES: { id: PhaseId; label: string }[] = [
  { id: "planning", label: "Planning" },
  { id: "ui", label: "UI Design" },
  { id: "frontend", label: "Frontend Generation" },
  { id: "backend", label: "Backend Generation" },
  { id: "database", label: "Database Setup" },
  { id: "auth", label: "Authentication" },
  { id: "api", label: "API Generation" },
  { id: "testing", label: "Testing" },
  { id: "building", label: "Building" },
  { id: "deployment", label: "Deployment" },
];

export type PhaseState = "pending" | "running" | "done" | "skipped" | "failed";

export function VibePhases({
  current,
  status,
  logs,
  failedAt,
}: {
  current: PhaseId | null;
  status: Record<PhaseId, PhaseState>;
  logs?: string[];
  failedAt?: PhaseId | null;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Generation pipeline
        </p>
        <p className="text-[10px] text-muted-foreground">
          {Object.values(status).filter((s) => s === "done").length}/{PHASES.length} complete
        </p>
      </div>
      <ol className="space-y-1.5">
        {PHASES.map((p) => {
          const s = status[p.id] ?? "pending";
          const isCurrent = current === p.id;
          return (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition",
                isCurrent && "bg-primary/10",
                s === "failed" && "bg-destructive/10",
              )}
            >
              <PhaseIcon state={s} />
              <span
                className={cn(
                  "flex-1",
                  s === "done" && "text-foreground",
                  s === "running" && "font-medium text-foreground",
                  s === "pending" && "text-muted-foreground",
                  s === "skipped" && "text-muted-foreground italic",
                  s === "failed" && "text-destructive",
                )}
              >
                {p.label}
              </span>
              {s === "skipped" && <span className="text-[10px] text-muted-foreground">skipped</span>}
              {s === "failed" && failedAt === p.id && (
                <span className="text-[10px] text-destructive">failed</span>
              )}
            </li>
          );
        })}
      </ol>
      {logs && logs.length > 0 && (
        <details className="mt-3 rounded-md border border-border/40 bg-background/40">
          <summary className="cursor-pointer px-2 py-1 text-[11px] text-muted-foreground">
            Build logs ({logs.length})
          </summary>
          <pre className="max-h-40 overflow-auto px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
            {logs.join("\n")}
          </pre>
        </details>
      )}
    </div>
  );
}

function PhaseIcon({ state }: { state: PhaseState }) {
  if (state === "running")
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />;
  if (state === "done")
    return (
      <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-500">
        <Check className="h-2.5 w-2.5" />
      </span>
    );
  if (state === "failed")
    return (
      <span className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-destructive/20 text-destructive">
        <X className="h-2.5 w-2.5" />
      </span>
    );
  if (state === "skipped")
    return <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-border" />;
  return <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />;
}

// Helper to drive the phases over time during a generation request.
// Phases march forward at a controlled cadence until "complete" is called.
export function usePhaseRunner(
  active: boolean,
  options?: { skipBackend?: boolean },
) {
  const [current, setCurrent] = useState<PhaseId | null>(null);
  const [status, setStatus] = useState<Record<PhaseId, PhaseState>>(() => initial());
  const [logs, setLogs] = useState<string[]>([]);
  const [failedAt, setFailedAt] = useState<PhaseId | null>(null);

  useEffect(() => {
    if (!active) return;
    setStatus(initial(options?.skipBackend));
    setLogs([]);
    setFailedAt(null);
    setCurrent("planning");
    const order: PhaseId[] = PHASES.map((p) => p.id);
    let cancelled = false;
    let i = 0;
    function step() {
      if (cancelled) return;
      if (i >= order.length - 1) return; // hold on the last phase until completion
      const phase = order[i];
      setStatus((s) => {
        if (s[phase] === "skipped") return s;
        return { ...s, [phase]: "done" };
      });
      const next = order[i + 1];
      const nextSkipped = options?.skipBackend && isBackendOnly(next);
      setCurrent(next);
      log(`✓ ${labelFor(phase)}`);
      if (nextSkipped) {
        setStatus((s) => ({ ...s, [next]: "skipped" }));
      } else {
        setStatus((s) => ({ ...s, [next]: "running" }));
      }
      i += 1;
      const delay = next === "deployment" ? 1200 : nextSkipped ? 250 : 700 + Math.random() * 600;
      setTimeout(step, delay);
    }
    setStatus((s) => ({ ...s, planning: "running" }));
    log("→ Planning architecture and components…");
    setTimeout(step, 600);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function log(line: string) {
    setLogs((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`].slice(-200));
  }

  function complete() {
    setStatus((s) => {
      const out = { ...s };
      for (const p of PHASES) {
        if (out[p.id] === "pending" || out[p.id] === "running") out[p.id] = "done";
      }
      return out;
    });
    setCurrent(null);
    log("✓ Deployment complete");
  }

  function fail(phase: PhaseId, message: string) {
    setStatus((s) => ({ ...s, [phase]: "failed" }));
    setFailedAt(phase);
    setCurrent(null);
    log(`✗ ${labelFor(phase)} — ${message}`);
  }

  function reset() {
    setStatus(initial(options?.skipBackend));
    setCurrent(null);
    setLogs([]);
    setFailedAt(null);
  }

  return { current, status, logs, failedAt, complete, fail, reset, log };
}

function initial(skipBackend = false): Record<PhaseId, PhaseState> {
  const out = {} as Record<PhaseId, PhaseState>;
  for (const p of PHASES) {
    out[p.id] = skipBackend && isBackendOnly(p.id) ? "skipped" : "pending";
  }
  return out;
}

function isBackendOnly(id: PhaseId) {
  return id === "backend" || id === "database" || id === "auth" || id === "api";
}

function labelFor(id: PhaseId) {
  return PHASES.find((p) => p.id === id)?.label ?? id;
}
