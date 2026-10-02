"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, CheckCircle2, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import type { BeoListItem } from "@/actions/beo.actions";

export const STATUS_HUE: Record<string, Hue> = {
  DRAFT: "slate",
  PUBLISHED: "emerald",
  LOCKED: "violet",
};
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  LOCKED: "Locked",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// The "New function sheet" create action lives in the page header's action
// cluster (beo/page.tsx, NewFunctionSheetDialog); this component is the list.
export function BeoDashboard({
  beos,
  canWrite,
}: {
  beos: BeoListItem[];
  /** beo:write. Only changes the empty-state copy here. */
  canWrite: boolean;
}) {
  const [filter, setFilter] = React.useState<string>("ALL");
  const [q, setQ] = React.useState("");

  const published = beos.filter((b) => b.status === "PUBLISHED").length;
  const locked = beos.filter((b) => b.status === "LOCKED").length;
  const openIncidents = beos.reduce((n, b) => n + (b.openIncidents ?? 0), 0);

  const filtered = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    return beos.filter((b) => {
      if (filter !== "ALL" && b.status !== filter) return false;
      if (!term) return true;
      return (
        b.beoNumber.toLowerCase().includes(term) ||
        (b.eventName ?? "").toLowerCase().includes(term) ||
        (b.venueName ?? "").toLowerCase().includes(term)
      );
    });
  }, [beos, filter, q]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: beos.length, DRAFT: 0, PUBLISHED: 0, LOCKED: 0 };
    for (const b of beos) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [beos]);

  return (
    <div className="flex flex-col gap-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Function sheets" value={beos.length} accent="indigo" icon={<ClipboardList className="size-4" />} />
        <StatTile label="Published" value={published} accent="emerald" icon={<CheckCircle2 className="size-4" />} sub={locked ? `${locked} locked` : undefined} />
        <StatTile label="Open incidents" value={openIncidents} accent="rose" icon={<AlertTriangle className="size-4" />} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "DRAFT", "PUBLISHED", "LOCKED"] as const).map((s) => (
            <StatusChip
              key={s}
              label={s === "ALL" ? "All" : STATUS_LABEL[s]}
              count={counts[s] ?? 0}
              active={filter === s}
              onClick={() => setFilter(s)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search BEO #, event, venue…"
            className="h-9 w-full sm:w-72"
          />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-copy">Function sheets</CardTitle></CardHeader>
        <CardContent className="p-0">
          {beos.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title="No function sheets yet"
              description={
                canWrite
                  ? "A function sheet (BEO) is the day-of playbook for a confirmed event. Click “New function sheet” above and pick a confirmed booking to build your first one."
                  : "Function sheets appear here once they’re created for confirmed events."
              }
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-body">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-meta uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">BEO #</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Covers</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">No function sheets match this filter.</td></tr>
                ) : (
                  filtered.map((b) => (
                    <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <Link href={`/beo/${b.id}`} className="font-medium text-foreground hover:underline">
                          {b.beoNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">{b.eventName ?? "—"}</div>
                        <div className="text-meta text-muted-foreground">
                          {[b.eventType, b.venueName].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(b.date)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{b.covers ?? "—"}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill label={STATUS_LABEL[b.status] ?? b.status} hue={STATUS_HUE[b.status] ?? "slate"} size="xs" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-detail font-medium ${active ? "border-foreground/15 bg-muted text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted/50"}`}
    >
      {label}
      <span className="rounded-md bg-foreground/10 px-1 text-meta tabular-nums">{count}</span>
    </button>
  );
}
