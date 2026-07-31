"use client";

// ============================================================
// InvoicesView — client shell for the Invoices landing. Owns the faceted
// filter state (Status + Month), and lays out the FacetFilterRail next to the
// data table. Stat strip + header live in the server page; this only handles
// the interactive filter → table flow.
// ============================================================

import * as React from "react";
import { format } from "date-fns";
import { FacetFilterRail, type FacetDef } from "@/components/shared/facet-filter-rail";
import { InvoicesTable, type InvoiceRow } from "./invoices-table";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function InvoicesView({ data }: { data: InvoiceRow[] }) {
  const [filtered, setFiltered] = React.useState<InvoiceRow[]>(data);

  const facets = React.useMemo<FacetDef<InvoiceRow>[]>(
    () => [
      {
        key: "status",
        label: "Status",
        get: (inv) => inv.status,
        format: (v) => STATUS_LABEL[v] ?? v.replace(/_/g, " "),
      },
      {
        key: "month",
        label: "Month",
        get: (inv) =>
          inv.issueDate ? format(new Date(inv.issueDate), "MMM yyyy") : null,
        max: 8,
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
        <InvoicesTable data={filtered} />
      </div>
    </div>
  );
}
