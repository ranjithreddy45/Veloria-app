"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, CalendarCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import { decideLeave } from "@/actions/hr-leave.actions";
import { toast } from "sonner";

interface Row {
  id: string; startDate: string; endDate: string; days: number; reason: string | null;
  appliedOnTime: boolean | null;
  leaveType: { name: string; code: string; color: string };
  employee: { id: string; firstName: string; lastName: string; empCode: string };
}

// 25th-cutoff punctuality badge: green "On time", red "Late", nothing for legacy (null).
function PunctualityBadge({ onTime }: { onTime: boolean | null }) {
  if (onTime == null) return null;
  return onTime ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">On time</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">Late</span>
  );
}

export function ApprovalQueue({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <CalendarCheck2 className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">Nothing waiting on you</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Leave requests routed to you appear here for approval.</p>
      </div>
    );
  }
  return <div className="space-y-3">{rows.map((r) => <Card key={r.id} row={r} />)}</div>;
}

function Card({ row }: { row: Row }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);
  const [note, setNote] = React.useState("");

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(decision);
    const res = await decideLeave(row.id, decision, note || undefined);
    if (!res.success) {
      toast.error(res.error);
      setBusy(null);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/people/${row.employee.id}`} className="font-medium hover:underline">
            {row.employee.firstName} {row.employee.lastName}
          </Link>
          <span className="ml-2 text-[12px] text-muted-foreground">{row.employee.empCode}</span>
          <div className="mt-1 flex items-center gap-2 text-[13px]">
            <StatusPill label={row.leaveType.code} hue={row.leaveType.color as never} size="xs" />
            <span>{formatDate(row.startDate)}{row.endDate !== row.startDate ? ` → ${formatDate(row.endDate)}` : ""}</span>
            <span className="font-medium tabular-nums">· {row.days} day{row.days === 1 ? "" : "s"}</span>
            <PunctualityBadge onTime={row.appliedOnTime} />
          </div>
          {row.reason && <p className="mt-1 text-[12.5px] text-muted-foreground">“{row.reason}”</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
            className="h-8 w-40 rounded-md border bg-background px-2 text-[12.5px] outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!!busy} onClick={() => decide("REJECTED")}>
            {busy === "REJECTED" ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Reject
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!!busy} onClick={() => decide("APPROVED")}>
            {busy === "APPROVED" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
