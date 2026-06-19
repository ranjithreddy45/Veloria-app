"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
  recomputePayoutForPeriod,
  approveRevenueSharePayout,
  markRevenueSharePayoutPaid,
  cancelRevenueSharePayout,
} from "@/actions/franchise-revshare.actions";

// ============================================================
// Payouts panel — recompute by period + maker-checker actions.
// ============================================================

interface VenueOpt {
  id: string;
  name: string;
}
interface PayoutRow {
  id: string;
  period: string;
  grossRevenue: number;
  netRevenue: number;
  shareAmount: number;
  currency: string;
  status: string;
  paymentRef: string | null;
  paidAt: string | null;
  venue?: { id: string; name: string } | null;
}

interface PayoutsPanelProps {
  partnerId: string;
  venues: VenueOpt[];
  payouts: PayoutRow[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  APPROVED:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  PAID: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
};

function defaultPeriod(): string {
  const d = new Date();
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  return `${prev.getUTCFullYear()}-${mm}`;
}

export function PayoutsPanel({ partnerId, venues, payouts }: PayoutsPanelProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const canApprove = can("franchise:payout:approve");

  const [period, setPeriod] = React.useState(defaultPeriod());
  const [venueId, setVenueId] = React.useState(venues[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [rowBusy, setRowBusy] = React.useState<string | null>(null);

  async function handleRecompute() {
    if (!venueId) {
      toast.error("Pick a venue");
      return;
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      toast.error("Period must be YYYY-MM");
      return;
    }
    setBusy(true);
    try {
      const result = await recomputePayoutForPeriod({ partnerId, venueId, period });
      if (result.success) {
        toast.success(
          result.skipped
            ? "Already approved/paid — left unchanged."
            : "Payout accrued."
        );
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to recompute");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove(id: string) {
    setRowBusy(id);
    try {
      const result = await approveRevenueSharePayout(id);
      if (result.success) {
        toast.success("Approved");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to approve");
      }
    } finally {
      setRowBusy(null);
    }
  }

  async function handleMarkPaid(id: string) {
    const paymentRef = window.prompt("Payment reference (optional)") ?? "";
    setRowBusy(id);
    try {
      const result = await markRevenueSharePayoutPaid(id, {
        paymentRef: paymentRef.trim() || null,
      });
      if (result.success) {
        toast.success("Marked paid");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to mark paid");
      }
    } finally {
      setRowBusy(null);
    }
  }

  async function handleCancel(id: string) {
    setRowBusy(id);
    try {
      const result = await cancelRevenueSharePayout(id);
      if (result.success) {
        toast.success("Cancelled");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to cancel");
      }
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="period">Period</Label>
          <Input
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="YYYY-MM"
            className="w-32"
          />
        </div>
        <div className="min-w-[200px] space-y-1.5">
          <Label>Venue</Label>
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a venue" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleRecompute} disabled={busy || !venueId}>
          {busy ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Recompute payout
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Period</th>
              <th className="px-4 py-2.5 font-medium">Venue</th>
              <th className="px-4 py-2.5 text-right font-medium">Gross</th>
              <th className="px-4 py-2.5 text-right font-medium">Net</th>
              <th className="px-4 py-2.5 text-right font-medium">Share</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                  No payouts yet. Recompute a period above.
                </td>
              </tr>
            )}
            {payouts.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2.5 tabular-nums">{p.period}</td>
                <td className="px-4 py-2.5">{p.venue?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatINR(p.grossRevenue)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatINR(p.netRevenue)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                  {formatINR(p.shareAmount)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={p.status} colorMap={STATUS_COLORS} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {canApprove && p.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rowBusy === p.id}
                        onClick={() => handleApprove(p.id)}
                      >
                        Approve
                      </Button>
                    )}
                    {canApprove && p.status === "APPROVED" && (
                      <Button
                        size="sm"
                        disabled={rowBusy === p.id}
                        onClick={() => handleMarkPaid(p.id)}
                      >
                        Mark paid
                      </Button>
                    )}
                    {(p.status === "PENDING" || p.status === "APPROVED") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={rowBusy === p.id}
                        onClick={() => handleCancel(p.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!canApprove && (
        <p className="text-xs text-muted-foreground">
          You can recompute accruals; approval and payment require the
          franchise:payout:approve permission.
        </p>
      )}
    </div>
  );
}
