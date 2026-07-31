"use client";

// ============================================================
// PayoutsView — client shell for the Payouts landing. Owns the faceted filter
// state (Status + Type) and lays out the FacetFilterRail next to the data
// table. The PageHeader + StatTile strip live in the server page; this only
// handles the interactive filter → table flow.
// ============================================================

import * as React from "react";
import { FacetFilterRail, type FacetDef } from "@/components/shared/facet-filter-rail";
import { PAYOUT_TYPE_LABELS } from "@/lib/constants";
import { PayoutTable, type PayoutRow } from "./payout-table";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export function PayoutsView({ data }: { data: PayoutRow[] }) {
  const [filtered, setFiltered] = React.useState<PayoutRow[]>(data);

  const facets = React.useMemo<FacetDef<PayoutRow>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        get: (p) => p.status,
        format: (v) => STATUS_LABEL[v] ?? v.replace(/_/g, " "),
      },
      {
        key: "type",
        label: "Type",
        get: (p) => p.type,
        format: (v) => PAYOUT_TYPE_LABELS[v] ?? v.replace(/_/g, " "),
      },
    ],
    []
  );

  return (
    <div className="flex gap-4">
      <FacetFilterRail
        items={data}
        facets={facets}
        onChange={setFiltered}
      />
      <div className="min-w-0 flex-1">
        <PayoutTable data={filtered} isFiltered={filtered.length !== data.length} />
      </div>
    </div>
  );
}
