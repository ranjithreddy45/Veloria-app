"use client";

// Shared client bits for the attendance reports: status → hue mapping, a
// date-range control strip, and an FY+month control strip. Kept deliberately
// small so each report view stays readable.

import * as React from "react";
import { CalendarRange } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import type { Hue } from "@/components/shared/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { AttendanceStatus } from "@prisma/client";
import { MONTHS, recentFys } from "../_lib/format";

const STATUS_HUE: Record<AttendanceStatus, Hue> = {
  PRESENT: "emerald",
  ABSENT: "red",
  HALF_DAY: "amber",
  WFH: "violet",
  ON_LEAVE: "blue",
  HOLIDAY: "slate",
  WEEKEND: "slate",
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  WFH: "WFH",
  ON_LEAVE: "On leave",
  HOLIDAY: "Holiday",
  WEEKEND: "Week-off",
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <StatusPill label={STATUS_LABEL[status]} hue={STATUS_HUE[status]} size="xs" />;
}

export function YesNoBadge({
  value,
  yes = "Yes",
  no = "No",
  unknown = "—",
}: {
  value: boolean | null | undefined;
  yes?: string;
  no?: string;
  unknown?: string;
}) {
  if (value == null) return <span className="text-muted-foreground">{unknown}</span>;
  return (
    <StatusPill label={value ? yes : no} hue={value ? "emerald" : "rose"} size="xs" />
  );
}

/** From/To date inputs + Apply. Controlled by the parent via draft state. */
export function DateRangeControls({
  from,
  to,
  onApply,
  loading,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  loading?: boolean;
}) {
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);
  React.useEffect(() => setF(from), [from]);
  React.useEffect(() => setT(to), [to]);

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <CalendarRange className="size-4" />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">From</span>
        <Input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} className="h-9 w-[9.5rem]" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">To</span>
        <Input type="date" value={t} min={f} onChange={(e) => setT(e.target.value)} className="h-9 w-[9.5rem]" />
      </label>
      <Button size="sm" className="h-9" disabled={loading || !f || !t} onClick={() => onApply(f, t)}>
        {loading ? "Loading…" : "Apply"}
      </Button>
    </div>
  );
}

/** FY + month selectors. Fires immediately on change. */
export function MonthControls({
  fy,
  month,
  onChange,
  loading,
}: {
  fy: string;
  month: number;
  onChange: (fy: string, month: number) => void;
  loading?: boolean;
}) {
  const fys = React.useMemo(() => recentFys(6), []);
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Select value={fy} onValueChange={(v) => onChange(v, month)} disabled={loading}>
        <SelectTrigger className="h-9 w-[8.5rem]"><SelectValue /></SelectTrigger>
        <SelectContent>{fys.map((x) => <SelectItem key={x} value={x}>FY {x}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={String(month)} onValueChange={(v) => onChange(fy, Number(v))} disabled={loading}>
        <SelectTrigger className="h-9 w-[8.5rem]"><SelectValue /></SelectTrigger>
        <SelectContent>{MONTHS.map((label, i) => <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>)}</SelectContent>
      </Select>
      {loading && <span className="text-[12px] text-muted-foreground">Loading…</span>}
    </div>
  );
}

/** A muted "how this is measured" note strip. */
export function MethodNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
