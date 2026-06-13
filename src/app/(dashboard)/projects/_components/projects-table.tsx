"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusPill } from "@/components/shared/status-pill";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PROJECT_PHASES, PROJECT_PHASE_LABEL, phaseIndex } from "@/lib/projects/phases";
import { healthBarClass, healthTextClass, phaseHue } from "@/lib/projects/ui";
import { cn } from "@/lib/utils";
import { ProjectsStatStrip } from "./projects-stat-strip";
import { Building2, ArrowUpDown, ArrowUp, ArrowDown, Search, SearchX } from "lucide-react";

export interface ProjectRow {
  id: string;
  phase: string;
  status: string;
  property: { propertyName: string; city: string; locality: string; status: string } | null;
  projectManager: { name: string | null } | null;
  targetReadyDate: string | null;
  readinessPct: number;
  launchedAt: string | null;
}

type SortKey = "readiness" | "phase";
type SortDir = "asc" | "desc";

const STALLED_STATUSES = new Set(["ON_HOLD", "CANCELLED"]);

// Compact health-banded readiness bar + %.
function ReadinessBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-premium", healthBarClass(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("w-9 text-right text-sm font-medium tabular-nums", healthTextClass(pct))}>
        {pct}%
      </span>
    </div>
  );
}

function PhasePill({ phase }: { phase: string }) {
  return <StatusPill label={PROJECT_PHASE_LABEL[phase] ?? phase} hue={phaseHue(phase)} size="xs" />;
}

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [phaseFilter, setPhaseFilter] = React.useState<string>("ALL");
  const [sortKey, setSortKey] = React.useState<SortKey>("phase");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  // Summary stats — derived from the full set, not the filtered view.
  const stats = React.useMemo(() => {
    const total = rows.length;
    const avgReadiness = total ? Math.round(rows.reduce((s, r) => s + r.readinessPct, 0) / total) : 0;
    const live = rows.filter((r) => r.phase === "LIVE").length;
    const stalled = rows.filter((r) => STALLED_STATUSES.has(r.status)).length;
    return { total, avgReadiness, live, stalled };
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (phaseFilter !== "ALL" && r.phase !== phaseFilter) return false;
      if (!q) return true;
      const p = r.property;
      return (
        !!p &&
        (p.propertyName.toLowerCase().includes(q) ||
          p.locality.toLowerCase().includes(q) ||
          p.city.toLowerCase().includes(q))
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const cmp =
        sortKey === "readiness"
          ? a.readinessPct - b.readinessPct
          : phaseIndex(a.phase) - phaseIndex(b.phase);
      return cmp * dir;
    });
    return out;
  }, [rows, query, phaseFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "readiness" ? "desc" : "asc");
    }
  }

  function sortIcon(active: SortKey) {
    if (sortKey !== active) return <ArrowUpDown className="size-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
  }

  // No projects at all — distinct from "filtered to nothing".
  if (rows.length === 0) {
    return (
      <Card className="py-0">
        <EmptyState
          className="py-16"
          icon={<Building2 className="size-5" />}
          title="No venue projects yet"
          description="A project is created automatically when the BD team closes (wins) a deal. It will appear here for the team to onboard."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <ProjectsStatStrip {...stats} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search venue or locality…"
            className="pl-9"
            aria-label="Search venue projects"
          />
        </div>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by phase">
            <SelectValue placeholder="All phases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All phases</SelectItem>
            {PROJECT_PHASES.map((p) => (
              <SelectItem key={p} value={p}>
                {PROJECT_PHASE_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-0">
          <EmptyState
            className="py-14"
            icon={<SearchX className="size-5" />}
            title="No venues match your filters"
            description="Try a different search term or clear the phase filter."
          />
        </Card>
      ) : (
        <>
          {/* Desktop / tablet: table with sticky header */}
          <Card className="hidden gap-0 overflow-hidden py-0 md:block">
            <div className="max-h-[calc(100vh-20rem)] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Venue</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("phase")}
                        className="inline-flex items-center gap-1 uppercase tracking-wider focus-ring rounded transition-premium hover:text-foreground"
                      >
                        Phase {sortIcon("phase")}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort("readiness")}
                        className="ml-auto inline-flex items-center gap-1 uppercase tracking-wider focus-ring rounded transition-premium hover:text-foreground"
                      >
                        Readiness {sortIcon("readiness")}
                      </button>
                    </TableHead>
                    <TableHead>Project Manager</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      onClick={() => router.push(`/projects/${r.id}`)}
                      className="card-hover-tint cursor-pointer transition-premium"
                    >
                      <TableCell className="font-medium">
                        <Link
                          href={`/projects/${r.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline"
                        >
                          {r.property?.propertyName ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.property ? `${r.property.locality}, ${r.property.city}` : "—"}
                      </TableCell>
                      <TableCell>
                        <PhasePill phase={r.phase} />
                      </TableCell>
                      <TableCell className="text-right">
                        <ReadinessBar pct={r.readinessPct} />
                      </TableCell>
                      <TableCell>
                        {r.projectManager?.name ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Mobile: stacked cards (no horizontal clipping) */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((r) => (
              <Card
                key={r.id}
                onClick={() => router.push(`/projects/${r.id}`)}
                className="card-hover-tint cursor-pointer gap-3 py-4 transition-premium"
              >
                <div className="flex items-start justify-between gap-3 px-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.property?.propertyName ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.property ? `${r.property.locality}, ${r.property.city}` : "—"}
                    </p>
                  </div>
                  <PhasePill phase={r.phase} />
                </div>
                <div className="px-4">
                  <ReadinessBar pct={r.readinessPct} />
                </div>
                <div className="px-4 text-xs text-muted-foreground">
                  PM: {r.projectManager?.name ?? "Unassigned"}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Loading placeholder mirroring the strip + table layout.
export function ProjectsTableSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-0 py-4">
            <div className="px-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <Skeleton className="h-9 w-full sm:w-56" />
      </div>
      <Card className="gap-0 py-0">
        <div className="space-y-px p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
