"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { formatDate } from "@/lib/utils";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_HUE } from "@/lib/hr/constants";
import { decideRegularization } from "@/actions/hr-attendance.actions";

interface Row {
  id: string; date: string; requestedStatus: string; reason: string;
  employee: { id: string; firstName: string; lastName: string; empCode: string };
}

export function RegnQueue({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <ClipboardCheck className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">No regularization requests</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Attendance corrections routed to you appear here.</p>
      </div>
    );
  }
  return <div className="space-y-3">{rows.map((r) => <Card key={r.id} row={r} />)}</div>;
}

function Card({ row }: { row: Row }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(d: "APPROVED" | "REJECTED") {
    setBusy(d);
    await decideRegularization(row.id, d);
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
            <span>{formatDate(row.date)}</span>
            <span>→</span>
            <StatusPill label={ATTENDANCE_STATUS_LABELS[row.requestedStatus]} hue={ATTENDANCE_STATUS_HUE[row.requestedStatus] as never} size="xs" />
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">“{row.reason}”</p>
        </div>
        <div className="flex gap-2">
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
