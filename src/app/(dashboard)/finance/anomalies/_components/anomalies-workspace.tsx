"use client";

// ============================================================
// Anomalies workspace — the interactive shell for Finance · Anomalies.
// Stat tiles, a status filter (segmented), the review table, and an admin
// "Run detection" button. Resolving / ignoring posts a server action and
// refreshes the route. Money is shown with numeric + formatINR.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ScanLine,
  Check,
  Ban,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { formatINR, cn } from "@/lib/utils";
import { ShieldAlertIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SegmentedControl, type SegmentOption } from "@/components/ui/segmented-control";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  detectAnomalies,
  setAnomalyStatus,
  type AnomalyRow,
} from "@/actions/finance-anomaly.actions";

type StatusParam = "all" | "open" | "resolved" | "ignored";
type Severity = "LOW" | "MEDIUM" | "HIGH";

const FILTER_OPTIONS: SegmentOption<StatusParam>[] = [
  { value: "all", label: "All", tone: "neutral" },
  { value: "open", label: "Open", tone: "danger" },
  { value: "resolved", label: "Resolved", tone: "done" },
  { value: "ignored", label: "Ignored", tone: "na" },
];

const SEVERITY_PILL: Record<Severity, string> = {
  HIGH: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
};

const STATUS_PILL: Record<string, string> = {
  OPEN: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
  RESOLVED: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
  IGNORED: "bg-muted text-muted-foreground",
};

const TYPE_LABEL: Record<string, string> = {
  DUPLICATE_PAYMENT: "Duplicate payment",
  ROUND_AMOUNT: "Round amount",
  WEEKEND_LARGE: "Weekend large entry",
  UNBALANCED: "Unbalanced entry",
  OUTLIER: "Outlier",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  canWrite: boolean;
  anomalies: AnomalyRow[];
  stats: { open: number; high: number; medium: number; low: number };
  filter: StatusParam;
}

export function AnomaliesWorkspace({ canWrite, anomalies, stats, filter }: Props) {
  const router = useRouter();
  const [running, setRunning] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  function setFilter(next: StatusParam) {
    const qs = next === "all" ? "" : `?status=${next}`;
    router.push(`/finance/anomalies${qs}`);
  }

  async function runDetection() {
    setRunning(true);
    try {
      const res = await detectAnomalies();
      if (res.success) {
        const { created } = res.data;
        toast.success(
          created > 0
            ? `Detection complete — ${created} new ${created === 1 ? "anomaly" : "anomalies"} flagged.`
            : "Detection complete — no new anomalies.",
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Could not run detection.");
    } finally {
      setRunning(false);
    }
  }

  async function changeStatus(id: string, status: "RESOLVED" | "IGNORED") {
    setPendingId(id);
    try {
      const res = await setAnomalyStatus(id, status);
      if (res.success) {
        toast.success(status === "RESOLVED" ? "Marked resolved." : "Marked ignored.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Could not update anomaly.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlertIcon}
        accent="rose"
        eyebrow="Finance · Anomalies"
        title="Anomalies"
        description="Automated fraud and irregularity checks across payments and the ledger, with a simple review queue."
      >
        {canWrite && (
          <Button onClick={runDetection} disabled={running}>
            <ScanLine className="size-4" />
            {running ? "Scanning…" : "Run detection"}
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Open anomalies"
          value={stats.open}
          accent="rose"
          icon={<ShieldAlert className="size-4" />}
          sub="Awaiting review"
        />
        <StatTile
          label="High severity"
          value={stats.high}
          accent="rose"
          icon={<ShieldAlert className="size-4" />}
          sub="Likely fraud"
        />
        <StatTile
          label="Medium severity"
          value={stats.medium}
          accent="amber"
          icon={<ShieldQuestion className="size-4" />}
          sub="Worth a look"
        />
        <StatTile
          label="Low severity"
          value={stats.low}
          accent="cyan"
          icon={<ShieldCheck className="size-4" />}
          sub="Informational"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter anomalies by status"
          size="sm"
        />
        <p className="text-xs text-muted-foreground">
          Accountant view —{" "}
          <Link href="/finance/reports" className="font-medium text-foreground underline-offset-2 hover:underline">
            shareable statements
          </Link>{" "}
          live in Reports.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        {anomalies.length === 0 ? (
          <EmptyState
            tone="success"
            icon={<Sparkles className="size-5" />}
            title="No anomalies — clean books ✨"
            description={
              filter === "all"
                ? canWrite
                  ? "Run detection to scan payments and the ledger for irregularities."
                  : "Nothing flagged yet."
                : "Nothing matches this filter."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Severity</TableHead>
                <TableHead className="w-[170px]">Type</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="text-right w-[140px]">Amount</TableHead>
                <TableHead className="w-[130px]">Detected</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                {canWrite && <TableHead className="text-right w-[180px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {anomalies.map((a) => {
                const sev = (a.severity as Severity) ?? "MEDIUM";
                const busy = pendingId === a.id;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          SEVERITY_PILL[sev],
                        )}
                      >
                        {sev}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {TYPE_LABEL[a.type] ?? a.type}
                    </TableCell>
                    <TableCell className="max-w-[420px] text-sm text-muted-foreground">
                      {a.message}
                    </TableCell>
                    <TableCell className="text-right text-sm numeric">
                      {a.amount === null ? "—" : formatINR(a.amount)}
                    </TableCell>
                    <TableCell className="text-sm numeric text-muted-foreground">
                      {fmtDate(a.detectedAt)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          STATUS_PILL[a.status] ?? STATUS_PILL.OPEN,
                        )}
                      >
                        {a.status}
                      </span>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        {a.status === "OPEN" ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => changeStatus(a.id, "RESOLVED")}
                            >
                              <Check className="size-3.5" />
                              Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => changeStatus(a.id, "IGNORED")}
                            >
                              <Ban className="size-3.5" />
                              Ignore
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => changeStatus(a.id, "RESOLVED")}
                            className="text-muted-foreground"
                          >
                            Reopen as resolved
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLink className="size-3" />
        Anomalies are flagged heuristically — always confirm against source documents before acting.
      </p>
    </div>
  );
}
