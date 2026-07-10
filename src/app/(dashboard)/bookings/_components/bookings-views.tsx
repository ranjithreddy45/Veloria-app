"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { LayoutList, Kanban as KanbanIcon, CalendarIcon, MapPinIcon, UsersIcon } from "lucide-react";

import { ViewTabs } from "@/components/ui/view-tabs";
import { KanbanBoard, type KanbanColumn, type ColumnHue } from "@/components/ui/kanban-board";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { TIME_SLOT_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { BookingsTable, type BookingRow } from "./bookings-table";

// ============================================================
// BookingsViews — ClickUp-style view switcher for the Bookings list.
// Wraps the existing (unchanged) table as the "List" view and adds a read-only
// "Board" view that groups the SAME already-fetched rows by status. Purely a
// view/presentation layer: no refetch, no server actions, no data mutation.
// ============================================================

type View = "list" | "board";

// Canonical lifecycle order + per-status display metadata. Column hues follow
// the app's existing booking-status colors so the board reads consistently.
const STATUS_META: Record<
  string,
  { label: string; columnHue: ColumnHue; pillHue: Hue }
> = {
  HOLD: { label: "On hold", columnHue: "amber", pillHue: "amber" },
  TENTATIVE: { label: "Tentative", columnHue: "blue", pillHue: "blue" },
  CONFIRMED: { label: "Confirmed", columnHue: "emerald", pillHue: "emerald" },
  IN_PROGRESS: { label: "In progress", columnHue: "violet", pillHue: "violet" },
  COMPLETED: { label: "Completed", columnHue: "teal", pillHue: "teal" },
  CANCELLED: { label: "Cancelled", columnHue: "rose", pillHue: "rose" },
};

const STATUS_ORDER = [
  "HOLD",
  "TENTATIVE",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

function timeSlotLabel(slot: string): string {
  return TIME_SLOT_LABELS[slot]?.split("(")[0]?.trim() || slot;
}

interface BookingsViewsProps {
  data: BookingRow[];
}

export function BookingsViews({ data }: BookingsViewsProps) {
  const [view, setView] = React.useState<View>("list");

  const columns = React.useMemo<KanbanColumn<BookingRow>[]>(() => {
    const buckets = new Map<string, BookingRow[]>();
    for (const b of data) {
      const key = STATUS_META[b.status] ? b.status : "TENTATIVE";
      const list = buckets.get(key);
      if (list) list.push(b);
      else buckets.set(key, [b]);
    }
    return STATUS_ORDER.filter((s) => (buckets.get(s)?.length ?? 0) > 0).map((s) => ({
      id: s,
      label: STATUS_META[s].label,
      hue: STATUS_META[s].columnHue,
      items: buckets.get(s) ?? [],
    }));
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
        <BookingsTable data={data} />
      ) : (
        <KanbanBoard
          columns={columns}
          getKey={(b) => b.id}
          emptyLabel="No bookings"
          renderCard={(b) => {
            const meta = STATUS_META[b.status];
            return (
              <Link href={`/bookings/${b.id}`} className="block space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-snug text-foreground">
                    {b.eventName}
                  </p>
                  {meta && (
                    <StatusPill label={meta.label} hue={meta.pillHue} size="xs" />
                  )}
                </div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {b.bookingNumber}
                </p>
                <div className="space-y-1 text-[11.5px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5 shrink-0" />
                    {format(new Date(b.date), "dd MMM yyyy")} · {timeSlotLabel(b.timeSlot)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPinIcon className="size-3.5 shrink-0" />
                    <span className="truncate">{b.venue?.name}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UsersIcon className="size-3.5 shrink-0" />
                    {b.guestCount} guests
                  </span>
                </div>
                <div className="flex items-center justify-end border-t border-border/50 pt-2">
                  <span className="text-[12px] font-bold tabular-nums text-foreground">
                    {formatINR(b.totalAmount)}
                  </span>
                </div>
              </Link>
            );
          }}
        />
      )}
    </div>
  );
}
