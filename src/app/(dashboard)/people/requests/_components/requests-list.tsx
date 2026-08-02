"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { decideChangeRequest } from "@/actions/hr-change-request.actions";

const FIELD_LABELS: Record<string, string> = {
  phone: "Phone", personalEmail: "Personal email", workLocation: "Work location",
};

export interface ChangeReq {
  id: string;
  employeeId: string;
  note: string | null;
  createdAt: string;
  changes: Record<string, { from: string | null; to: string }>;
  employee: { firstName: string; lastName: string; empCode: string } | null;
}

export function RequestsList({ requests }: { requests: ChangeReq[] }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <Inbox className="mx-auto size-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">No pending change requests</p>
        <p className="mt-1 text-body text-muted-foreground">When employees request profile changes, they’ll appear here for approval.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {requests.map((r) => <Card key={r.id} req={r} />)}
    </div>
  );
}

function Card({ req }: { req: ChangeReq }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(decision);
    const res = await decideChangeRequest(req.id, decision);
    setBusy(null);
    if (res && !res.success) {
      toast.error(res.error ?? "Failed to update change request");
      return;
    }
    router.refresh();
  }

  const name = req.employee ? `${req.employee.firstName} ${req.employee.lastName}` : "Employee";

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/people/${req.employeeId}`} className="font-medium hover:underline">{name}</Link>
          <span className="ml-2 text-detail text-muted-foreground">{req.employee?.empCode}</span>
          <p className="text-detail text-muted-foreground">{formatDateTime(req.createdAt)}</p>
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
      <div className="mt-3 space-y-1.5">
        {Object.entries(req.changes).map(([field, v]) => (
          <div key={field} className="flex items-center gap-2 text-body">
            <span className="w-28 shrink-0 text-muted-foreground">{FIELD_LABELS[field] ?? field}</span>
            <span className="text-muted-foreground/70 line-through">{v.from || "—"}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{v.to}</span>
          </div>
        ))}
      </div>
      {req.note && <p className="mt-2 text-detail text-muted-foreground">“{req.note}”</p>}
    </div>
  );
}
