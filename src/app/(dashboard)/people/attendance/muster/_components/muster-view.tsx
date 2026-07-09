"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Users, CheckCircle2, CircleSlash, Home, Plane, AlertTriangle, Loader2, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  getDailyMuster, getMonthlyRegister,
  type DailyMuster, type MonthlyRegister, type MusterStatus,
} from "@/actions/hr-attendance-register.actions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_META: Record<MusterStatus, { label: string; hue: Hue; code: string; cell: string }> = {
  PRESENT:  { label: "Present",   hue: "emerald", code: "P",  cell: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  WFH:      { label: "WFH",       hue: "cyan",    code: "W",  cell: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" },
  HALF_DAY: { label: "Half day",  hue: "amber",   code: "½",  cell: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  ON_LEAVE: { label: "On leave",  hue: "blue",    code: "L",  cell: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  ABSENT:   { label: "Absent",    hue: "rose",    code: "A",  cell: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
  HOLIDAY:  { label: "Holiday",   hue: "violet",  code: "H",  cell: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
  WEEKEND:  { label: "Weekend",   hue: "slate",   code: "•",  cell: "bg-muted text-muted-foreground" },
};

function fyOptions(): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() + 1 >= 4 ? y : y - 1;
  const out: string[] = [];
  for (let s = start + 1; s >= start - 2; s--) out.push(`${s}-${String((s + 1) % 100).padStart(2, "0")}`);
  return out;
}

/** Format an instant as IST clock time, e.g. "3:42 PM". */
function istTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function prettyDay(dateStr: string): string {
  // Anchor to UTC so the label matches the UTC-midnight day key.
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function MusterView({
  initialDate, initial, initialFy, initialMonth,
}: {
  initialDate: string;
  initial: DailyMuster | null;
  initialFy: string;
  initialMonth: number;
}) {
  const [tab, setTab] = React.useState<"day" | "month">("day");

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-card p-0.5 text-sm">
        <button
          type="button"
          onClick={() => setTab("day")}
          className={`rounded-md px-3 py-1.5 font-medium transition ${tab === "day" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Daily muster
        </button>
        <button
          type="button"
          onClick={() => setTab("month")}
          className={`rounded-md px-3 py-1.5 font-medium transition ${tab === "month" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Monthly register
        </button>
      </div>

      {tab === "day"
        ? <DayView initialDate={initialDate} initial={initial} />
        : <MonthView initialFy={initialFy} initialMonth={initialMonth} />}
    </div>
  );
}

// ============================================================
// Daily muster
// ============================================================
function DayView({ initialDate, initial }: { initialDate: string; initial: DailyMuster | null }) {
  const [date, setDate] = React.useState(initialDate);
  const [muster, setMuster] = React.useState<DailyMuster | null>(initial);
  const [loading, setLoading] = React.useState(false);
  const [q, setQ] = React.useState("");

  async function onDate(next: string) {
    if (!next) return;
    setDate(next);
    setLoading(true);
    const data = await getDailyMuster({ date: next });
    setLoading(false);
    if (!data) { toast.error("Couldn't load the muster for that day."); return; }
    setMuster(data);
  }

  const rows = React.useMemo(() => {
    const list = muster?.rows ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(term)
        || r.empCode.toLowerCase().includes(term)
        || (r.department ?? "").toLowerCase().includes(term),
    );
  }, [muster, q]);

  const s = muster?.summary;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">Day</label>
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="h-9" />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code or department" className="h-9 pl-8" />
          </div>
        </div>
        {loading && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
      </div>

      <p className="text-[12.5px] text-muted-foreground">{prettyDay(date)}</p>

      {/* Summary */}
      {s && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Headcount" value={s.headcount} accent="indigo" icon={<Users />} />
          <StatTile label="Present" value={s.present} accent="emerald" icon={<CheckCircle2 />} />
          <StatTile label="WFH" value={s.wfh} accent="cyan" icon={<Home />} />
          <StatTile label="On leave" value={s.onLeave} accent="blue" icon={<Plane />} />
          <StatTile label="Absent" value={s.absent} accent="rose" icon={<CircleSlash />} />
          <StatTile label="Flagged" value={s.flagged} accent="amber" icon={<AlertTriangle />} sub="needs review" />
        </div>
      )}

      {/* Table */}
      {!muster ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No muster available.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {q ? "No employees match your search." : "No active employees on the roster."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in (IST)</TableHead>
                <TableHead>Check-out (IST)</TableHead>
                <TableHead>Visit</TableHead>
                <TableHead className="text-right">Worked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.ABSENT;
                return (
                  <TableRow key={r.employeeId}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <div className="font-mono text-[11.5px] text-muted-foreground">{r.empCode}</div>
                    </TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">{r.department ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusPill label={meta.label} hue={meta.hue} size="sm" />
                        {r.flagged && (
                          <span title={r.flagReason ?? "Needs review"}>
                            <StatusPill label="flagged" hue="amber" size="xs" />
                          </span>
                        )}
                        {r.isRegularized && <StatusPill label="regularized" hue="violet" size="xs" />}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-[12.5px]">{r.checkInAt ? istTime(r.checkInAt) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="tabular-nums text-[12.5px]">{r.checkOutAt ? istTime(r.checkOutAt) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-[12.5px] text-muted-foreground">{r.visitType ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-[12.5px]">
                      {r.workedMinutes > 0 ? `${Math.floor(r.workedMinutes / 60)}h ${r.workedMinutes % 60}m` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Monthly register grid
// ============================================================
function MonthView({ initialFy, initialMonth }: { initialFy: string; initialMonth: number }) {
  const fys = React.useMemo(fyOptions, []);
  const [fy, setFy] = React.useState(initialFy);
  const [month, setMonth] = React.useState(String(initialMonth));
  const [reg, setReg] = React.useState<MonthlyRegister | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (f: string, m: number) => {
    setLoading(true);
    const data = await getMonthlyRegister({ fy: f, month: m });
    setLoading(false);
    if (!data) { toast.error("Couldn't load the register."); return; }
    setReg(data);
  }, []);

  React.useEffect(() => { load(initialFy, initialMonth); }, [load, initialFy, initialMonth]);

  const days = reg ? Array.from({ length: reg.daysInMonth }, (_, i) => i + 1) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">Financial year</label>
          <Select value={fy} onValueChange={(v) => { setFy(v); load(v, Number(month)); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{fys.map((f) => <SelectItem key={f} value={f}>FY {f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">Month</label>
          <Select value={month} onValueChange={(v) => { setMonth(v); load(fy, Number(v)); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((label, i) => <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {loading && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground">
        {(Object.keys(STATUS_META) as MusterStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`inline-flex size-5 items-center justify-center rounded text-[11px] font-semibold ${STATUS_META[k].cell}`}>{STATUS_META[k].code}</span>
            {STATUS_META[k].label}
          </span>
        ))}
      </div>

      {!reg ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">Loading register…</div>
      ) : reg.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">No active employees on the roster.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card">Employee</TableHead>
                {days.map((d) => <TableHead key={d} className="px-0 text-center text-[11px] font-medium tabular-nums">{d}</TableHead>)}
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reg.rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <div className="whitespace-nowrap font-medium">{r.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r.empCode}</div>
                  </TableCell>
                  {days.map((d) => {
                    const st = r.days[d];
                    const meta = st ? STATUS_META[st] : null;
                    return (
                      <TableCell key={d} className="p-1 text-center">
                        {meta
                          ? <span title={meta.label} className={`inline-flex size-6 items-center justify-center rounded text-[11px] font-semibold ${meta.cell}`}>{meta.code}</span>
                          : <span className="text-muted-foreground/40">·</span>}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold tabular-nums">{r.present}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
