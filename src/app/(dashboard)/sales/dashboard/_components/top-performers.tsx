import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ordinal, rankTopPerformers, type PerformerInput } from "@/lib/sales/top-performers";

// ============================================================
// Top performers — the first thing on the Sales dashboard.
//
// Who closed how many in the selected period, so the whole team can see it
// without scrolling to the table. "Closed" is the same figure that table calls
// "Confirmed" (see lib/sales/top-performers.ts); this component only displays
// the rows it is given and never recounts.
//
// The first three get the large cards; everyone else who closed at least one
// follows as a compact row, so nobody who closed is left out. Place is written
// as text ("1st", "Joint 2nd") as well as coloured, so it never depends on
// colour alone.
// ============================================================

const inr = (n: number) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

// Gold / silver / bronze for places 1–3; text colours chosen to clear 4.5:1 on
// their own tint in both themes.
const MEDAL: Record<number, string> = {
  1: "bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200",
  2: "bg-slate-200 text-slate-800 dark:bg-slate-400/20 dark:text-slate-200",
  3: "bg-orange-100 text-orange-900 dark:bg-orange-400/20 dark:text-orange-200",
};

export function TopPerformers({ employees, period }: { employees: readonly PerformerInput[]; period: string }) {
  const ranked = rankTopPerformers(employees);
  const podium = ranked.filter((r) => r.place <= 3).slice(0, 3);
  const rest = ranked.slice(podium.length);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="flex items-center gap-2 text-body font-semibold">
            <Trophy className="size-4 text-amber-600 dark:text-amber-300" aria-hidden />
            Top performers
          </h2>
          <p className="text-meta text-muted-foreground">Bookings confirmed · {period}</p>
        </div>

        {ranked.length === 0 ? (
          <p className="text-detail text-muted-foreground">
            No bookings have been confirmed in this period yet. The first one puts a name here.
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {podium.map((r) => (
                <li
                  key={r.userId}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4",
                    r.place === 1 && "border-amber-300/70 dark:border-amber-300/30"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-full text-body font-semibold",
                      MEDAL[r.place] ?? "bg-muted text-foreground"
                    )}
                    aria-hidden
                  >
                    {initials(r.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-meta font-medium uppercase tracking-[0.06em] text-muted-foreground">
                      {r.tied ? `Joint ${ordinal(r.place)}` : ordinal(r.place)}
                    </div>
                    <div className="truncate text-body font-semibold text-foreground">{r.name || "Unnamed"}</div>
                    <div className="text-meta text-muted-foreground">{inr(r.revenue)} booked</div>
                  </div>
                  <div className="text-right">
                    <div className="numeric text-[28px] font-semibold leading-none tabular-nums">{r.bookingsConfirmed}</div>
                    <div className="mt-1 text-meta text-muted-foreground">closed</div>
                  </div>
                </li>
              ))}
            </ol>

            {rest.length > 0 && (
              <ol start={podium.length + 1} className="flex flex-wrap gap-2" aria-label="Everyone else who closed a booking">
                {rest.map((r) => (
                  <li
                    key={r.userId}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1.5 pl-3 pr-3.5 text-detail"
                  >
                    <span className="text-meta text-muted-foreground">{r.tied ? `Joint ${ordinal(r.place)}` : ordinal(r.place)}</span>
                    <span className="font-medium text-foreground">{r.name || "Unnamed"}</span>
                    <span className="numeric font-semibold tabular-nums">{r.bookingsConfirmed}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
