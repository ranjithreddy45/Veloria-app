"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import {
  FacetFilterRail,
  type FacetDef,
} from "@/components/shared/facet-filter-rail";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptIcon } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { exportPayments } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { PaymentRowActions } from "./payment-row-actions";

// ============================================================
// Types
// ============================================================

type PaymentRow = {
  id: string;
  amount: number | string | { toString(): string };
  status: string;
  method: string;
  cancelPending?: boolean;
  transactionId?: string | null;
  receiptNumber?: string | null;
  paidAt?: Date | string | null;
  createdAt: Date | string;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number | string | { toString(): string };
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      company?: string | null;
    };
  };
};

// ============================================================
// Format Helpers — StatusPill hue/label maps for status + method
// ============================================================

const STATUS_HUE: Record<string, Hue> = {
  COMPLETED: "emerald",
  PENDING: "amber",
  PROCESSING: "blue",
  FAILED: "red",
  REFUNDED: "violet",
  CANCELLED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  PENDING: "Pending",
  PROCESSING: "Processing",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

const METHOD_HUE: Record<string, Hue> = {
  CASH: "emerald",
  BANK_TRANSFER: "blue",
  CHEQUE: "purple",
  UPI: "indigo",
  RAZORPAY: "cyan",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  UPI: "UPI",
  RAZORPAY: "Razorpay",
};

// ============================================================
// Columns
// ============================================================

function makeColumns(perms: {
  canCancel: boolean;
  isManager: boolean;
}): ColumnDef<PaymentRow, unknown>[] {
  return [
  {
    accessorKey: "receiptNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Receipt #" />
    ),
    cell: ({ row }) => (
      <span className="numeric text-[13px] font-medium">
        {row.original.receiptNumber || row.original.id.slice(0, 8)}
      </span>
    ),
  },
  {
    accessorKey: "invoice",
    header: "Invoice",
    cell: ({ row }) => (
      <Link
        href={`/invoices/${row.original.invoice.id}`}
        className="numeric text-[13px] font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
      >
        {row.original.invoice.invoiceNumber}
      </Link>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    cell: ({ row }) => {
      const c = row.original.invoice.contact;
      return (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">
            {c.firstName} {c.lastName}
          </div>
          {c.company && (
            <div className="truncate text-[12px] text-muted-foreground">
              {c.company}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <div className="flex justify-end">
        <DataTableColumnHeader column={column} title="Amount" />
      </div>
    ),
    cell: ({ row }) => (
      <div
        className={
          row.original.status === "COMPLETED"
            ? "numeric text-right text-[13px] font-semibold text-success"
            : "numeric text-right text-[13px] font-semibold text-foreground"
        }
      >
        {formatINR(row.original.amount)}
      </div>
    ),
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => {
      const method = row.original.method;
      return (
        <StatusPill
          label={METHOD_LABEL[method] ?? method.replace(/_/g, " ")}
          hue={METHOD_HUE[method] ?? "neutral"}
          size="xs"
          noDot
        />
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      return (
        <div className="flex items-center gap-1.5">
          <StatusPill
            label={STATUS_LABEL[status] ?? status}
            hue={STATUS_HUE[status] ?? "neutral"}
            size="xs"
          />
          {row.original.cancelPending && status !== "CANCELLED" && (
            <StatusPill label="Cancel pending" hue="amber" size="xs" noDot />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "paidAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const date = row.original.paidAt || row.original.createdAt;
      return (
        <span className="numeric text-[12.5px] text-muted-foreground">
          {format(new Date(date), "dd MMM yyyy")}
        </span>
      );
    },
  },
  {
    accessorKey: "transactionId",
    header: "Transaction ID",
    cell: ({ row }) => (
      <span className="numeric text-[12.5px] text-muted-foreground">
        {row.original.transactionId || "—"}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <PaymentRowActions
        paymentId={row.original.id}
        invoiceId={row.original.invoice.id}
        status={row.original.status}
        cancelPending={!!row.original.cancelPending}
        canCancel={perms.canCancel}
        isManager={perms.isManager}
      />
    ),
  },
  ];
}

// ============================================================
// PaymentsTable Component
// ============================================================

interface PaymentsTableProps {
  data: PaymentRow[];
  canCancel?: boolean;
  isManager?: boolean;
}

function ExportButton() {
  const [loading, setLoading] = React.useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportPayments();
      if (result.success) {
        const csv = toCSV(result.data.headers, result.data.rows);
        downloadCSV(`payments-${new Date().toISOString().split("T")[0]}.csv`, csv);
        toast.success("Payments exported successfully");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to export payments");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <DownloadIcon className="mr-2 size-4" />
      {loading ? "Exporting..." : "Export CSV"}
    </Button>
  );
}

// ============================================================
// Facets — Status + Method (live counts derived by the rail)
// ============================================================

const PAYMENT_FACETS: FacetDef<PaymentRow>[] = [
  {
    key: "status",
    label: "Status",
    get: (p) => p.status,
    format: (v) => STATUS_LABEL[v] ?? v,
  },
  {
    key: "method",
    label: "Method",
    get: (p) => p.method,
    format: (v) => METHOD_LABEL[v] ?? v.replace(/_/g, " "),
  },
];

export function PaymentsTable({ data, canCancel = false, isManager = false }: PaymentsTableProps) {
  const [faceted, setFaceted] = React.useState<PaymentRow[]>(data);
  const columns = React.useMemo(
    () => makeColumns({ canCancel, isManager }),
    [canCancel, isManager],
  );

  React.useEffect(() => setFaceted(data), [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border bg-card shadow-card">
        <EmptyState
          icon={<ReceiptIcon className="size-5" />}
          title="No payments yet"
          description="Recorded and collected payments will appear here once invoices are paid."
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4">
      <FacetFilterRail
        items={data}
        facets={PAYMENT_FACETS}
        onChange={setFaceted}
        className="hidden lg:block"
      />
      <div className="min-w-0 flex-1">
        <DataTable
          columns={columns}
          data={faceted}
          searchKey="receiptNumber"
          searchPlaceholder="Search payments..."
          toolbarExtra={<ExportButton />}
        />
      </div>
    </div>
  );
}
