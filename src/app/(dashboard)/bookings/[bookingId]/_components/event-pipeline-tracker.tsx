import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// CR-002 — Event Lifecycle Stage Pipeline Tracker
// A visual 6-stage pipeline on the Event Detail page showing completion across
// the post-sales lifecycle, with an overall health %. Stages are DERIVED from
// existing data (booking status, BEO, vendor assignments) so it never adds a
// separate source of truth. Stages not yet backed by a module show "pending"
// and light up as those modules (CR-006/007) ship.
// ============================================================

export type StageStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING";

export interface PipelineStage {
  name: string;
  status: StageStatus;
  /** Who is responsible (role/team label). */
  who?: string | null;
  /** Completion / update timestamp. */
  at?: Date | string | null;
  /** Short plain-language detail shown when the stage is expanded. */
  detail?: string;
}

const STATUS_META: Record<StageStatus, { label: string; dot: string; text: string; ring: string }> = {
  COMPLETED: { label: "Completed", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-200 dark:ring-emerald-900" },
  IN_PROGRESS: { label: "In progress", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-200 dark:ring-amber-900" },
  PENDING: { label: "Pending", dot: "bg-zinc-300 dark:bg-zinc-600", text: "text-muted-foreground", ring: "ring-border" },
};

export function EventPipelineTracker({ stages }: { stages: PipelineStage[] }) {
  const completed = stages.filter((s) => s.status === "COMPLETED").length;
  const health = Math.round((completed / stages.length) * 100);
  const healthColor =
    health >= 80 ? "text-success" : health >= 40 ? "text-warning" : "text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-premium">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Event lifecycle</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {completed} of {stages.length} stages complete
          </p>
        </div>
        <div className="text-right">
          <div className={cn("text-2xl font-bold tabular-nums leading-none", healthColor)}>{health}%</div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">event health</div>
        </div>
      </div>

      {/* Stepper */}
      <ol className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-0">
        {stages.map((s, i) => {
          const m = STATUS_META[s.status];
          const isLast = i === stages.length - 1;
          return (
            <li key={s.name} className="relative flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
              <div className="flex items-center sm:w-full sm:flex-col">
                <span className={cn("z-[1] flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm", m.dot)}>
                  {s.status === "COMPLETED" ? (
                    <CheckCircle2 className="size-5" />
                  ) : s.status === "IN_PROGRESS" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                </span>
                {/* connector */}
                {!isLast && (
                  <span
                    aria-hidden
                    className={cn(
                      "hidden h-0.5 flex-1 sm:block",
                      s.status === "COMPLETED" ? "bg-emerald-400" : "bg-border"
                    )}
                  />
                )}
              </div>
              <div className="min-w-0 pb-2 sm:mt-2 sm:px-1">
                <p className="text-[12.5px] font-medium leading-tight">{s.name}</p>
                <p className={cn("text-[11px] font-medium", m.text)}>{m.label}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Expandable per-stage detail */}
      <div className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60">
        {stages.map((s, i) => {
          const m = STATUS_META[s.status];
          return (
            <details key={s.name} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-muted/40">
                <span className={cn("size-2 shrink-0 rounded-full", m.dot)} />
                <span className="font-medium">{i + 1}. {s.name}</span>
                <span className={cn("ml-auto text-[11px] font-medium", m.text)}>{m.label}</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-1 px-4 pb-3 pl-9 text-[12.5px] text-muted-foreground">
                {s.detail && <p>{s.detail}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px]">
                  {s.who && <span>Owner: <span className="text-foreground/70">{s.who}</span></span>}
                  {s.at && <span>Updated: <span className="text-foreground/70">{format(new Date(s.at), "d MMM yyyy, h:mm a")}</span></span>}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
