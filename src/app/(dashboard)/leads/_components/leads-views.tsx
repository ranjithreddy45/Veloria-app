"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, IndianRupee, LayoutList, Kanban as KanbanIcon } from "lucide-react";

import { ViewTabs } from "@/components/ui/view-tabs";
import { KanbanBoard, type KanbanColumn, type ColumnHue } from "@/components/ui/kanban-board";
import { LeadStatusPill } from "@/components/shared/status-pill";
import { LeadsTable, type LeadWithContact } from "./leads-table";

// ============================================================
// LeadsViews — ClickUp-style List / Board switcher for the Leads module.
// View-layer only: the SAME already-fetched, already-serialized leads are
// either handed to the existing table (List, default) or grouped by pipeline
// stage into a read-only Kanban board (Board). No refetch, no server action.
// ============================================================

type ViewMode = "list" | "board";

// Pipeline stages in funnel order, each with a fitting column hue:
// early = blue/cyan, mid = violet/amber/pink, won = emerald, lost = rose.
const STAGE_ORDER: Array<{ status: string; label: string; hue: ColumnHue }> = [
  { status: "NEW", label: "New", hue: "blue" },
  { status: "CONTACTED", label: "Contacted", hue: "cyan" },
  { status: "QUALIFIED", label: "Qualified", hue: "violet" },
  { status: "PROPOSAL_SENT", label: "Proposal Sent", hue: "amber" },
  { status: "NEGOTIATION", label: "Negotiation", hue: "pink" },
  { status: "WON", label: "Won", hue: "emerald" },
  { status: "LOST", label: "Lost", hue: "rose" },
];

function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)} K`;
  return `₹${v.toLocaleString("en-IN")}`;
}

function BoardCard({ lead }: { lead: LeadWithContact }) {
  const fullName = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();
  const value = lead.estimatedValue != null ? formatCurrency(Number(lead.estimatedValue)) : null;
  return (
    <Link href={`/leads/${lead.id}`} className="block space-y-2">
      <p className="truncate text-[13px] font-semibold leading-snug text-foreground">
        {lead.title}
      </p>
      <p className="truncate text-[11.5px] text-muted-foreground">
        {fullName || "—"}
        {lead.eventType ? <span className="text-muted-foreground/60"> · {lead.eventType}</span> : null}
      </p>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <LeadStatusPill status={lead.status} size="xs" />
        {value ? (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-bold tabular-nums text-foreground/90">
            <IndianRupee className="size-3" strokeWidth={2.5} />
            {value.replace(/^₹/, "")}
          </span>
        ) : lead.eventDate ? (
          <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
            <CalendarDays className="size-3" />
            {format(new Date(lead.eventDate as string), "MMM d")}
          </span>
        ) : (
          <span />
        )}
      </div>
    </Link>
  );
}

export function LeadsViews({ data }: { data: LeadWithContact[] }) {
  const [view, setView] = React.useState<ViewMode>("list");

  const columns = React.useMemo<KanbanColumn<LeadWithContact>[]>(() => {
    const byStatus = new Map<string, LeadWithContact[]>();
    for (const lead of data) {
      const bucket = byStatus.get(lead.status);
      if (bucket) bucket.push(lead);
      else byStatus.set(lead.status, [lead]);
    }
    const cols: KanbanColumn<LeadWithContact>[] = STAGE_ORDER.map((s) => ({
      id: s.status,
      label: s.label,
      hue: s.hue,
      items: byStatus.get(s.status) ?? [],
    }));
    // Safety net: a lead whose status isn't one of the mapped stages (e.g. a
    // stage added to the enum later) must never silently vanish from the board.
    const mapped = new Set(STAGE_ORDER.map((s) => s.status));
    const unmapped = data.filter((l) => !mapped.has(l.status));
    if (unmapped.length > 0) {
      cols.push({ id: "__other", label: "Other", hue: "slate", items: unmapped });
    }
    return cols;
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ViewTabs
          value={view}
          onValueChange={setView}
          options={[
            { value: "list", label: "List", icon: LayoutList },
            { value: "board", label: "Board", icon: KanbanIcon },
          ]}
        />
      </div>
      {view === "list" ? (
        <LeadsTable data={data} />
      ) : (
        <KanbanBoard
          columns={columns}
          getKey={(lead) => lead.id}
          emptyLabel="No leads in this stage"
          renderCard={(lead) => <BoardCard lead={lead} />}
        />
      )}
    </div>
  );
}
