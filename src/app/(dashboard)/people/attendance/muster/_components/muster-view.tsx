"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users, CheckCircle2, CircleSlash, Home, Plane, AlertTriangle, Loader2, Search,
  Download, Printer, Pencil, MapPin, ShieldOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  getDailyMuster, getMonthlyRegister,
  type DailyMuster, type MonthlyRegister, type MusterStatus,
} from "@/actions/hr-attendance-register.actions";
import { markAttendanceManually } from "@/actions/hr-attendance.actions";

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

/** The 7 AttendanceStatus values, in the order shown in the edit Select. */
const STATUS_VALUES: MusterStatus[] = [
  "PRESENT", "ABSENT", "HALF_DAY", "WFH", "ON_LEAVE", "HOLIDAY", "WEEKEND",
];

/** Single-letter register codes for CSV export (distinct from the grid glyphs). */
const CSV_CODE: Record<MusterStatus, string> = {
  PRESENT: "P", ABSENT: "A", HALF_DAY: "HD", WFH: "W",
  ON_LEAVE: "L", HOLIDAY: "H", WEEKEND: "WO",
};

/** Zero-padded UTC-midnight day key for a register cell, e.g. "2026-07-09". */
function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * GPS verification chip mirroring checkIn() semantics:
 *   true  → GPS matched an active site radius (emerald)
 *   false → outside radius or on-site-but-bad-IP, flagged (amber)
 *   null  → not applicable: CLIENT visit or no sites configured (slate)
 */
function verifyMeta(v: boolean | null): { label: string; hue: Hue } {
  if (v === true) return { label: "Verified", hue: "emerald" };
  if (v === false) return { label: "Unverified", hue: "amber" };
  return { label: "No geo", hue: "slate" };
}

/** A Google-Maps link for a captured lat/lng, labelled with the 5dp coords. */
function MapLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Open check-in location in Google Maps"
      className="inline-flex items-center gap-1 text-meta font-medium text-indigo-600 hover:underline dark:text-indigo-400"
    >
      <MapPin className="size-3.5" />
      <span className="tabular-nums">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
    </a>
  );
}

/**
 * Prominent amber banner shown when NO active attendance site has coordinates,
 * so check-ins are recorded but never geo-verified (a silent failure otherwise).
 */
function GeoOffBanner({ canAdmin }: { canAdmin: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-body text-warning">
      <ShieldOff className="mt-0.5 size-5 shrink-0 text-warning" />
      <div className="space-y-0.5">
        <p className="font-semibold">Location verification is OFF</p>
        <p>
          No attendance site has coordinates configured, so check-ins are recorded but never geo-verified.{" "}
          {canAdmin ? (
            <a href="/people/attendance/sites" className="font-medium underline underline-offset-2">
              Configure a site
            </a>
          ) : (
            <span>Ask an HR admin to configure a site.</span>
          )}
        </p>
      </div>
    </div>
  );
}

export function MusterView({
  initialDate, initial, initialFy, initialMonth, canEdit, canAdmin,
}: {
  initialDate: string;
  initial: DailyMuster | null;
  initialFy: string;
  initialMonth: number;
  canEdit: boolean;
  canAdmin: boolean;
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
        ? <DayView initialDate={initialDate} initial={initial} canAdmin={canAdmin} />
        : <MonthView initialFy={initialFy} initialMonth={initialMonth} canEdit={canEdit} canAdmin={canAdmin} />}
    </div>
  );
}

// ============================================================
// Daily muster
// ============================================================
function DayView({ initialDate, initial, canAdmin }: { initialDate: string; initial: DailyMuster | null; canAdmin: boolean }) {
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

  function exportCsv() {
    if (!muster || muster.rows.length === 0) { toast.error("Nothing to export."); return; }
    const headers = [
      "Code", "Name", "Department", "Status",
      "Check-in (IST)", "Check-out (IST)", "Worked (hrs)", "Flagged",
      "Site", "Verified", "Lat", "Lng",
    ];
    const body = muster.rows.map((r) => [
      r.empCode,
      r.name,
      r.department ?? "",
      STATUS_META[r.status]?.label ?? r.status,
      r.checkInAt ? istTime(r.checkInAt) : "",
      r.checkOutAt ? istTime(r.checkOutAt) : "",
      (r.workedMinutes / 60).toFixed(2),
      r.flagged ? "Yes" : "",
      r.siteName ?? "",
      verifyMeta(r.locationVerified).label,
      r.lat != null ? r.lat.toFixed(5) : "",
      r.lng != null ? r.lng.toFixed(5) : "",
    ]);
    downloadCSV(`muster-daily-${date}.csv`, toCSV(headers, body));
  }

  function openPrint() {
    window.open(`/api/hr/muster?date=${encodeURIComponent(date)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-4">
      {/* Silent-failure guard: geo verification not operative. */}
      {muster && !muster.geoEnabled && <GeoOffBanner canAdmin={canAdmin} />}

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        {/* w-48 + a 12rem-min search is 384px — wider than a 375px viewport — so
         * the date picker goes full-width on a phone and the search sits below. */}
        <div className="w-full sm:w-48">
          <label className="mb-1 block text-detail font-medium text-muted-foreground">Day</label>
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="h-9" />
        </div>
        <div className="w-full flex-1 sm:min-w-[12rem]">
          <label className="mb-1 block text-detail font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, code or department" className="h-9 pl-8" />
          </div>
        </div>
        {loading && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!muster || muster.rows.length === 0}>
            <Download /> Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openPrint}>
            <Printer /> Print / PDF
          </Button>
        </div>
      </div>

      <p className="text-detail text-muted-foreground">{prettyDay(date)}</p>

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
                <TableHead>Location</TableHead>
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
                      <div className="font-mono text-meta text-muted-foreground">{r.empCode}</div>
                    </TableCell>
                    <TableCell className="text-detail text-muted-foreground">{r.department ?? "—"}</TableCell>
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
                    <TableCell className="tabular-nums text-detail">{r.checkInAt ? istTime(r.checkInAt) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="tabular-nums text-detail">{r.checkOutAt ? istTime(r.checkOutAt) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-detail text-muted-foreground">{r.visitType ?? "—"}</TableCell>
                    <TableCell className="text-detail">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-muted-foreground">{r.siteName ?? "—"}</span>
                          {(() => {
                            const vm = verifyMeta(r.locationVerified);
                            return <StatusPill label={vm.label} hue={vm.hue} size="xs" />;
                          })()}
                        </div>
                        {r.lat != null && r.lng != null && <MapLink lat={r.lat} lng={r.lng} />}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-detail">
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
function MonthView({ initialFy, initialMonth, canEdit, canAdmin }: { initialFy: string; initialMonth: number; canEdit: boolean; canAdmin: boolean }) {
  const router = useRouter();
  const fys = React.useMemo(fyOptions, []);
  const [fy, setFy] = React.useState(initialFy);
  const [month, setMonth] = React.useState(String(initialMonth));
  const [reg, setReg] = React.useState<MonthlyRegister | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Click-to-edit dialog target (HR-privileged only).
  const [edit, setEdit] = React.useState<
    { employeeId: string; name: string; empCode: string; date: string; current: MusterStatus | null } | null
  >(null);
  const [editStatus, setEditStatus] = React.useState<MusterStatus>("PRESENT");
  const [editNote, setEditNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async (f: string, m: number) => {
    setLoading(true);
    const data = await getMonthlyRegister({ fy: f, month: m });
    setLoading(false);
    if (!data) { toast.error("Couldn't load the register."); return; }
    setReg(data);
  }, []);

  React.useEffect(() => { load(initialFy, initialMonth); }, [load, initialFy, initialMonth]);

  const days = reg ? Array.from({ length: reg.daysInMonth }, (_, i) => i + 1) : [];

  function openEdit(row: MonthlyRegister["rows"][number], day: number) {
    if (!reg) return;
    const current = row.days[day] ?? null;
    setEdit({
      employeeId: row.employeeId,
      name: row.name,
      empCode: row.empCode,
      date: dayKey(reg.year, reg.month, day),
      current,
    });
    setEditStatus(current ?? "PRESENT");
    setEditNote("");
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const res = await markAttendanceManually({
      employeeId: edit.employeeId,
      date: edit.date,
      status: editStatus,
      note: editNote.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) { toast.error(res.error || "Couldn't save."); return; }
    toast.success("Attendance updated.");
    setEdit(null);
    // Refresh server data and re-pull the register so the grid reflects the change.
    router.refresh();
    load(fy, Number(month));
  }

  function exportCsv() {
    if (!reg || reg.rows.length === 0) { toast.error("Nothing to export."); return; }
    const headers = [
      "Code", "Name", "Department",
      ...days.map((d) => String(d)),
      "Present", "Absent", "Leave", "WFH",
    ];
    const body = reg.rows.map((r) => {
      const dayCells = days.map((d) => {
        const st = r.days[d];
        return st ? CSV_CODE[st] : "";
      });
      const vals = Object.values(r.days);
      const present = vals.filter((s) => s === "PRESENT" || s === "HALF_DAY").length;
      const absent = vals.filter((s) => s === "ABSENT").length;
      const leave = vals.filter((s) => s === "ON_LEAVE").length;
      const wfh = vals.filter((s) => s === "WFH").length;
      return [r.empCode, r.name, r.department ?? "", ...dayCells, present, absent, leave, wfh];
    });
    downloadCSV(`muster-register-${reg.fy}-${String(reg.month).padStart(2, "0")}.csv`, toCSV(headers, body));
  }

  function openPrint() {
    window.open(
      `/api/hr/muster?fy=${encodeURIComponent(fy)}&month=${encodeURIComponent(month)}`,
      "_blank", "noopener,noreferrer",
    );
  }

  return (
    <div className="space-y-4">
      {/* Silent-failure guard: geo verification not operative. */}
      {reg && !reg.geoEnabled && <GeoOffBanner canAdmin={canAdmin} />}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40">
          <label className="mb-1 block text-detail font-medium text-muted-foreground">Financial year</label>
          <Select value={fy} onValueChange={(v) => { setFy(v); load(v, Number(month)); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{fys.map((f) => <SelectItem key={f} value={f}>FY {f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="mb-1 block text-detail font-medium text-muted-foreground">Month</label>
          <Select value={month} onValueChange={(v) => { setMonth(v); load(fy, Number(v)); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((label, i) => <SelectItem key={i} value={String(i + 1)}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {loading && <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!reg || reg.rows.length === 0}>
            <Download /> Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openPrint}>
            <Printer /> Print / PDF
          </Button>
        </div>
      </div>

      {canEdit && (
        <p className="text-meta text-muted-foreground">
          <Pencil className="mr-1 inline size-3 align-[-1px]" />
          Click any cell to correct that day&rsquo;s attendance.
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-muted-foreground">
        {(Object.keys(STATUS_META) as MusterStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`inline-flex size-5 items-center justify-center rounded text-meta font-semibold ${STATUS_META[k].cell}`}>{STATUS_META[k].code}</span>
            {STATUS_META[k].label}
          </span>
        ))}
      </div>

      {!reg ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">Loading register…</div>
      ) : reg.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">No active employees on the roster.</div>
      ) : (
        <>
        {/* Up to 31 day columns can never fit 375px. The Employee column is
          * already frozen with sticky left-0 so the reader keeps their place;
          * this line makes the sideways scroll deliberate rather than a page
          * that merely feels broken. */}
        <p className="text-detail text-muted-foreground sm:hidden">
          Swipe the register sideways to move through the month — the employee column stays put.
        </p>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card">Employee</TableHead>
                {days.map((d) => <TableHead key={d} className="px-0 text-center text-meta font-medium tabular-nums">{d}</TableHead>)}
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reg.rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell className="sticky left-0 z-10 bg-card">
                    <div className="whitespace-nowrap font-medium">{r.name}</div>
                    <div className="font-mono text-meta text-muted-foreground">{r.empCode}</div>
                  </TableCell>
                  {days.map((d) => {
                    const st = r.days[d];
                    const meta = st ? STATUS_META[st] : null;
                    const glyph = meta
                      ? <span title={meta.label} className={`inline-flex size-6 items-center justify-center rounded text-meta font-semibold ${meta.cell}`}>{meta.code}</span>
                      : <span className="text-muted-foreground/40">·</span>;
                    return (
                      <TableCell key={d} className="p-1 text-center">
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => openEdit(r, d)}
                            title={`Edit ${r.name} — day ${d}`}
                            className="inline-flex items-center justify-center rounded transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {glyph}
                          </button>
                        ) : glyph}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold tabular-nums">{r.present}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {/* Admin click-to-edit dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Correct attendance</DialogTitle>
            <DialogDescription>
              {edit ? `${edit.name} (${edit.empCode}) · ${prettyDay(edit.date)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-detail font-medium text-muted-foreground">Status</label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as MusterStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-detail font-medium text-muted-foreground">Note <span className="font-normal">(optional)</span></label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Reason for the correction"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEdit(null)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
