"use client";

// ============================================================
// Event Profitability — client workspace. Filters write to the URL (the server
// page re-queries); everything else (sort, CSV) is local. The numbers come in
// already computed by src/lib/finance/event-profitability.ts — this file only
// presents them, and is deliberately explicit about what each figure is and
// where the data is missing.
// ============================================================

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Download,
  HandCoins,
  Info,
  Loader2,
  MapPin,
  Percent,
  Wallet,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { cn, formatINR } from "@/lib/utils";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { FLAG_LABEL, type DataStatus, type EventProfitabilityRow } from "@/lib/finance/event-profitability";
import type {
  EventProfitabilityReport as ReportData,
  ProfitabilityStatusFilter,
  ProfitabilityVenueOption,
} from "@/actions/finance-profitability.actions";

// ---------- helpers ----------

// Booking.date is a UTC-midnight @db.Date — format it in UTC so the calendar
// day never shifts with the viewer's timezone.
const DAY_FMT = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const fmtDay = (iso: string) => DAY_FMT.format(new Date(iso));
const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type PresetKey = "month" | "last-month" | "quarter" | "fy" | "last-fy" | "custom";
const PRESETS: { value: PresetKey; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "fy", label: "This financial year" },
  { value: "last-fy", label: "Last financial year" },
  { value: "custom", label: "Custom range" },
];

function presetRange(key: PresetKey, now = new Date()): { from: string; to: string } | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const fyStart = m >= 3 ? y : y - 1; // Indian FY: Apr → Mar
  switch (key) {
    case "month":
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case "last-month":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: ymd(new Date(y, qStart, 1)), to: ymd(new Date(y, qStart + 3, 0)) };
    }
    case "fy":
      return { from: ymd(new Date(fyStart, 3, 1)), to: ymd(new Date(fyStart + 1, 2, 31)) };
    case "last-fy":
      return { from: ymd(new Date(fyStart - 1, 3, 1)), to: ymd(new Date(fyStart, 2, 31)) };
    default:
      return null;
  }
}

const STATUS_OPTIONS: { value: ProfitabilityStatusFilter; label: string }[] = [
  { value: "ACTIVE", label: "All except cancelled" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "TENTATIVE", label: "Tentative" },
  { value: "HOLD", label: "On hold" },
  { value: "CANCELLED", label: "Cancelled only" },
  { value: "ALL", label: "All incl. cancelled" },
];

const DATA_STATUS: Record<DataStatus, { label: string; hue: Hue }> = {
  complete: { label: "Complete", hue: "emerald" },
  partial: { label: "Partial", hue: "amber" },
  "no-cost-data": { label: "No cost data", hue: "rose" },
  "no-revenue": { label: "No revenue", hue: "slate" },
};

const BOOKING_HUE: Record<string, Hue> = {
  HOLD: "slate",
  TENTATIVE: "amber",
  CONFIRMED: "blue",
  IN_PROGRESS: "cyan",
  COMPLETED: "emerald",
  CANCELLED: "rose",
};

type SortKey =
  | "eventName" | "date" | "venueName" | "customer" | "invoiced" | "collected"
  | "vendorPaid" | "otherPaid" | "staffCost" | "grossMargin" | "marginPct";
type SortDir = "asc" | "desc";

function staffNote(r: EventProfitabilityRow): string {
  if (r.staffAssignmentCount === 0) return "No staff rostered on this event's operation.";
  if (r.staffCost == null)
    return `${r.staffAssignmentCount} staff rostered (${r.staffHours}h) but none has an hourly rate on their staff profile — set StaffProfile.hourlyRate to estimate.`;
  if (r.staffUnratedCount > 0)
    return `Estimate covers ${r.staffAssignmentCount - r.staffUnratedCount} of ${r.staffAssignmentCount} rostered staff; ${r.staffUnratedCount} have no hourly rate. Rate × rostered hours, not payroll. Not in margin.`;
  return `Rate × rostered hours (${r.staffHours}h) for ${r.staffAssignmentCount} staff — an estimate, not payroll. Not in margin.`;
}

function SortHead({
  k, sortKey, sortDir, onToggle, children, className,
}: {
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (k: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <TableHead className={cn("whitespace-nowrap", className)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onToggle(k)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 -mx-1 text-meta font-medium uppercase tracking-wide hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-50" />}
      </button>
    </TableHead>
  );
}

// ---------- component ----------

interface Props {
  filters: { from: string; to: string; venueId: string; status: ProfitabilityStatusFilter };
  venues: ProfitabilityVenueOption[];
  report: ReportData | null;
  error: string | null;
}

export function EventProfitabilityReport({ filters, venues, report, error }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const push = React.useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [sp, pathname, router],
  );

  // Which preset (if any) the current window matches — derived, not stored, so
  // the dropdown always tells the truth about the URL.
  const activePreset = React.useMemo<PresetKey>(() => {
    for (const p of PRESETS) {
      if (p.value === "custom") continue;
      const r = presetRange(p.value);
      if (r && r.from === filters.from && r.to === filters.to) return p.value;
    }
    return "custom";
  }, [filters.from, filters.to]);

  const [sortKey, setSortKey] = React.useState<SortKey>("date");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "eventName" || k === "venueName" || k === "customer" || k === "date" ? "asc" : "desc");
    }
  };

  const rows = React.useMemo(() => {
    const list = report?.rows ?? [];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls (no margin / no staff estimate) always sink to the bottom.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [report, sortKey, sortDir]);

  const totals = report?.totals ?? null;

  const exportCsv = () => {
    if (!report) return;
    const headers = [
      "Booking #", "Event", "Type", "Booking status", "Event date", "Venue", "Customer",
      "Contract value", "Invoiced (accrual)", "Collected (cash)", "Refunded", "Balance due",
      "Vendor paid", "Vendor committed", "Vendor agreed (pre-bill)", "Other paid", "Other committed",
      "Pending approval", "Staff est.", "Staff hours", "Gross margin", "Margin %", "Committed margin",
      "Data status", "Flags",
    ];
    const body = rows.map((r) => [
      r.bookingNumber, r.eventName, r.eventType, r.bookingStatus, r.date.slice(0, 10), r.venueName, r.customer,
      r.contractValue, r.invoiced, r.collected, r.refunded, r.balanceDue,
      r.vendorPaid, r.vendorCommitted, r.vendorAgreed, r.otherPaid, r.otherCommitted,
      r.pendingCost, r.staffCost ?? "", r.staffHours, r.grossMargin ?? "", r.marginPct ?? "", r.committedMargin ?? "",
      DATA_STATUS[r.dataStatus].label, r.flags.map((f) => FLAG_LABEL[f]).join("; "),
    ]);
    downloadCSV(`event-profitability-${report.range.from}_${report.range.to}.csv`, toCSV(headers, body));
  };

  const sortProps = { sortKey, sortDir, onToggle: toggleSort };

  return (
    <div className="space-y-5">
      {/* ---------------- Filters ---------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-muted-foreground" />
          <Select
            value={activePreset}
            onValueChange={(v) => {
              const r = presetRange(v as PresetKey);
              if (r) push({ from: r.from, to: r.to });
            }}
          >
            <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESETS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={filters.from} max={filters.to} className="h-9 w-[150px]" onChange={(e) => e.target.value && push({ from: e.target.value })} aria-label="From event date" />
          <span className="text-body text-muted-foreground">→</span>
          <Input type="date" value={filters.to} min={filters.from} className="h-9 w-[150px]" onChange={(e) => e.target.value && push({ to: e.target.value })} aria-label="To event date" />
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="size-4 text-muted-foreground" />
          <Select value={filters.venueId || "all"} onValueChange={(v) => push({ venue: v === "all" ? null : v })}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="All venues" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All venues</SelectItem>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}{v.isActive ? "" : " (inactive)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={filters.status} onValueChange={(v) => push({ status: v === "ACTIVE" ? null : v })}>
          <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!report || rows.length === 0} className="gap-1.5">
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 py-0 shadow-card">
          <CardContent className="flex items-start gap-3 px-5 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-body text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ---------------- KPI tiles ---------------- */}
      {totals && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Collected (cash)"
            value={formatINR(totals.collected)}
            accent="emerald"
            icon={<Wallet className="size-4" />}
            sub={`Invoiced (accrual) ${formatINR(totals.invoiced)}${totals.refunded > 0 ? ` · refunded ${formatINR(totals.refunded)}` : ""}`}
          />
          <StatTile
            label="Vendor cost (paid)"
            value={formatINR(totals.vendorPaid)}
            accent="amber"
            icon={<HandCoins className="size-4" />}
            sub={`Committed ${formatINR(totals.vendorCommitted)} · other paid ${formatINR(totals.otherPaid)}`}
          />
          <StatTile
            label="Gross margin"
            value={totals.costedBookings > 0 ? formatINR(totals.grossMargin) : "—"}
            accent={totals.grossMargin < 0 ? "red" : "gold"}
            icon={<Sparkles className="size-4" />}
            sub={
              totals.costedBookings > 0
                ? `Collected − paid costs, across ${totals.costedBookings} of ${totals.bookings} events with cost data`
                : `No event in range has approved cost data yet`
            }
          />
          <StatTile
            label="Avg margin %"
            value={fmtPct(totals.avgMarginPct)}
            accent={totals.avgMarginPct != null && totals.avgMarginPct < 0 ? "red" : "brand"}
            icon={<Percent className="size-4" />}
            sub={
              totals.avgMarginPct != null
                ? `Weighted by cash collected on ${totals.costedBookings} costed event${totals.costedBookings === 1 ? "" : "s"}`
                : "Needs at least one event with cost data"
            }
          />
        </div>
      )}

      {/* ---------------- Coverage / honesty strip ---------------- */}
      {totals && totals.bookings > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Info className="size-3.5" /> {totals.bookings} event{totals.bookings === 1 ? "" : "s"} in range</span>
          {totals.noCostDataBookings > 0 && (
            <span className="text-rose-600 dark:text-rose-300">{totals.noCostDataBookings} without approved cost data (excluded from margin)</span>
          )}
          {totals.noRevenueBookings > 0 && <span>{totals.noRevenueBookings} with no invoice or cash yet</span>}
          {totals.pendingCost > 0 && <span>{formatINR(totals.pendingCost)} of costs awaiting approval</span>}
          {totals.committedCost - totals.paidCost > 0.005 && (
            <span>{formatINR(totals.committedCost - totals.paidCost)} committed but unpaid</span>
          )}
          <span>
            Staff estimate {totals.staffEstimatedBookings > 0 ? formatINR(totals.staffCost) : "—"} on {totals.staffEstimatedBookings} event{totals.staffEstimatedBookings === 1 ? "" : "s"}
            {totals.staffUnratedBookings > 0 ? ` · ${totals.staffUnratedBookings} with unrated staff` : ""} (not in margin)
          </span>
          {report?.truncated && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
              <AlertTriangle className="size-3.5" /> Showing the first {report.cap.toLocaleString("en-IN")} events by date — narrow the range for the rest.
            </span>
          )}
        </div>
      )}

      {/* ---------------- Table ---------------- */}
      <Card className="overflow-hidden py-0 shadow-card">
        <CardContent className="p-0">
          {!report ? (
            <EmptyState tone="warning" icon={<AlertTriangle className="size-5" />} title="Report unavailable" description={error ?? "Try again."} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-5" />}
              title="No events in this window"
              description="No bookings have an event date in the selected range for this venue and status. Widen the range or change the filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead {...sortProps} k="eventName">Event</SortHead>
                    <SortHead {...sortProps} k="date">Date</SortHead>
                    <SortHead {...sortProps} k="venueName">Venue</SortHead>
                    <SortHead {...sortProps} k="customer">Customer</SortHead>
                    <SortHead {...sortProps} k="invoiced" className="text-right">Invoiced</SortHead>
                    <SortHead {...sortProps} k="collected" className="text-right">Collected</SortHead>
                    <SortHead {...sortProps} k="vendorPaid" className="text-right">Vendor cost</SortHead>
                    <SortHead {...sortProps} k="otherPaid" className="text-right">Other cost</SortHead>
                    <SortHead {...sortProps} k="staffCost" className="text-right">Staff (est.)</SortHead>
                    <SortHead {...sortProps} k="grossMargin" className="text-right">Margin</SortHead>
                    <SortHead {...sortProps} k="marginPct" className="text-right">Margin %</SortHead>
                    <TableHead className="text-meta font-medium uppercase tracking-wide text-muted-foreground">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const ds = DATA_STATUS[r.dataStatus];
                    const flagText = r.flags.map((f) => FLAG_LABEL[f]).join(" · ");
                    return (
                      <TableRow key={r.bookingId}>
                        <TableCell className="max-w-[260px]">
                          <Link href={`/bookings/${r.bookingId}`} className="block truncate font-medium hover:underline" title={r.eventName}>
                            {r.eventName}
                          </Link>
                          <div className="mt-0.5 flex items-center gap-1.5 text-meta text-muted-foreground">
                            <span className="numeric">{r.bookingNumber}</span>
                            <StatusPill label={r.bookingStatus.replace("_", " ")} hue={BOOKING_HUE[r.bookingStatus] ?? "slate"} size="xs" noDot />
                          </div>
                        </TableCell>
                        <TableCell className="numeric text-muted-foreground">{fmtDay(r.date)}</TableCell>
                        <TableCell className="max-w-[160px] truncate text-muted-foreground" title={r.venueName}>{r.venueName}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-muted-foreground" title={r.customer}>{r.customer}</TableCell>
                        <TableCell className="numeric text-right" title={`Issued invoices (accrual). Contract value ${formatINR(r.contractValue)}.`}>
                          {r.invoiced > 0 ? formatINR(r.invoiced) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="numeric text-right" title={r.refunded > 0 ? `Gross ${formatINR(r.collectedGross)} − refunded ${formatINR(r.refunded)}` : "Completed payments (cash)"}>
                          {r.collected > 0 ? formatINR(r.collected) : <span className="text-muted-foreground">—</span>}
                          {r.balanceDue > 0 && <div className="text-meta text-amber-600 dark:text-amber-300">due {formatINR(r.balanceDue)}</div>}
                        </TableCell>
                        <TableCell className="numeric text-right" title={`Paid ${formatINR(r.vendorPaid)} · committed ${formatINR(r.vendorCommitted)}${r.vendorAgreed > 0 ? ` · agreed ${formatINR(r.vendorAgreed)}` : ""}`}>
                          {r.vendorPaid > 0 || r.vendorCommitted > 0 ? formatINR(r.vendorPaid) : <span className="text-muted-foreground">—</span>}
                          {r.vendorCommitted - r.vendorPaid > 0.005 && (
                            <div className="text-meta text-muted-foreground">of {formatINR(r.vendorCommitted)}</div>
                          )}
                        </TableCell>
                        <TableCell className="numeric text-right" title={`Commission / owner payout / cash referral. Paid ${formatINR(r.otherPaid)} · committed ${formatINR(r.otherCommitted)}${r.pendingCost > 0 ? ` · pending approval ${formatINR(r.pendingCost)}` : ""}`}>
                          {r.otherPaid > 0 || r.otherCommitted > 0 ? formatINR(r.otherPaid) : <span className="text-muted-foreground">—</span>}
                          {r.otherCommitted - r.otherPaid > 0.005 && (
                            <div className="text-meta text-muted-foreground">of {formatINR(r.otherCommitted)}</div>
                          )}
                        </TableCell>
                        <TableCell className="numeric text-right text-muted-foreground" title={staffNote(r)}>
                          {r.staffCost == null ? "—" : formatINR(r.staffCost)}
                          {r.staffUnratedCount > 0 && <div className="text-meta text-amber-600 dark:text-amber-300">{r.staffUnratedCount} unrated</div>}
                        </TableCell>
                        <TableCell
                          className={cn("numeric text-right font-medium", r.grossMargin != null && r.grossMargin < 0 && "text-destructive")}
                          title={r.grossMargin == null ? "No approved cost record on this booking — margin not shown rather than assumed 100%." : `Collected − paid costs. After committed costs: ${formatINR(r.committedMargin)}`}
                        >
                          {r.grossMargin == null ? <span className="font-normal text-muted-foreground">—</span> : formatINR(r.grossMargin)}
                        </TableCell>
                        <TableCell className={cn("numeric text-right", r.marginPct != null && r.marginPct < 0 && "text-destructive")}>
                          {r.marginPct == null ? <span className="text-muted-foreground">—</span> : fmtPct(r.marginPct)}
                        </TableCell>
                        <TableCell title={flagText || "Invoiced, collected and every committed cost is paid."}>
                          <StatusPill label={ds.label} hue={ds.hue} size="xs" />
                          {r.flags.length > 0 && (
                            <div className="mt-0.5 max-w-[200px] truncate text-meta text-muted-foreground">{flagText}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Definitions ---------------- */}
      <div className="space-y-1 text-meta leading-relaxed text-muted-foreground">
        <p><span className="font-medium text-foreground">Invoiced</span> = issued invoices on the booking (status not draft/cancelled) — the accrual figure the Finance P&amp;L uses. <span className="font-medium text-foreground">Collected</span> = completed payments minus refunds — the cash figure the Dashboard uses. Contract value (booking total) is in the CSV for reference only.</p>
        <p><span className="font-medium text-foreground">Vendor cost</span> = paid vendor payouts (advances included); &ldquo;of&rdquo; shows the committed figure = approved vendor bills + approved/paid payouts not linked to a bill (net of advances already netted into a bill). <span className="font-medium text-foreground">Other cost</span> = commission entries, commission/owner payouts and cash referral rewards, paid vs approved. Pending (unapproved) items are flagged, not counted.</p>
        <p><span className="font-medium text-foreground">Margin</span> = collected − paid costs, shown only when the booking has at least one approved or paid cost record; an event with no cost data is marked as such, not as 100% margin. <span className="font-medium text-foreground">Staff (est.)</span> = rostered hours × the staff member&rsquo;s hourly rate; it is an estimate, shows &ldquo;—&rdquo; where no rostered staff has a rate, and is never deducted from margin.</p>
      </div>
    </div>
  );
}
