// ============================================================
// Commission visual helpers — KPI strip + status pill mapper.
// Visual-only, derived entirely from existing entry fields
// (commissionAmount, status). No data-model or API changes.
// ============================================================

import { BanknoteIcon, ClockIcon, WalletIcon } from "lucide-react";

import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { formatINR } from "@/lib/utils";

export interface CommissionTotals {
  count: number;
  total: number;
  pending: number;
  paid: number;
}

// ------------------------------------------------------------
// Status pill mapping (mirrors COMMISSION_STATUS_COLORS hues)
// ------------------------------------------------------------

const COMMISSION_STATUS_HUE: Record<string, Hue> = {
  PENDING: "amber",
  APPROVED: "blue",
  PAID: "emerald",
};

const COMMISSION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
};

export function CommissionStatusPill({
  status,
  size,
}: {
  status: string;
  size?: "xs" | "sm";
}) {
  return (
    <StatusPill
      label={COMMISSION_STATUS_LABEL[status] ?? status}
      hue={COMMISSION_STATUS_HUE[status] ?? "neutral"}
      size={size}
    />
  );
}

// ------------------------------------------------------------
// KPI strip
// ------------------------------------------------------------

export function CommissionStatStrip({ totals }: { totals: CommissionTotals }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        label="Total commission"
        value={<span className="tabular-nums">{formatINR(totals.total)}</span>}
        accent="emerald"
        icon={<WalletIcon className="size-4" />}
        sub={`${totals.count} ${totals.count === 1 ? "entry" : "entries"}`}
      />
      <StatTile
        label="Pending approval"
        value={<span className="tabular-nums">{formatINR(totals.pending)}</span>}
        accent="amber"
        icon={<ClockIcon className="size-4" />}
        sub="Awaiting sign-off"
      />
      <StatTile
        label="Paid out"
        value={<span className="tabular-nums">{formatINR(totals.paid)}</span>}
        accent="rose"
        icon={<BanknoteIcon className="size-4" />}
        sub="Settled to payees"
      />
    </div>
  );
}
