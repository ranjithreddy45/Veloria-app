"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { EyeIcon, MoreHorizontalIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { PAYMENT_STATUS_COLORS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { exportPayments } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";

// ============================================================
// Types
// ============================================================

type PaymentRow = {
  id: string;
  amount: number | string | { toString(): string };
  status: string;
  method: string;
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
// Format Helpers
// ============================================================

const METHOD_COLORS: Record<string, string> = {
  CASH: "bg-green-100 text-green-800 border-green-200",
  BANK_TRANSFER: "bg-blue-100 text-blue-800 border-blue-200",
  CHEQUE: "bg-purple-100 text-purple-800 border-purple-200",
  UPI: "bg-indigo-100 text-indigo-800 border-indigo-200",
  RAZORPAY: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

// ============================================================
// Columns
// ============================================================

const columns: ColumnDef<PaymentRow, unknown>[] = [
  {
    accessorKey: "receiptNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Receipt #" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">
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
        className="font-medium text-blue-600 hover:underline"
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
        <div>
          <div className="font-medium">
            {c.firstName} {c.lastName}
          </div>
          {c.company && (
            <div className="text-xs text-muted-foreground">{c.company}</div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <span className="font-medium text-green-700">
        {formatINR(row.original.amount)}
      </span>
    ),
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => {
      const method = row.original.method;
      const colors = METHOD_COLORS[method] || "";
      return (
        <Badge variant="outline" className={`${colors} border text-xs`}>
          {method.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const colors = PAYMENT_STATUS_COLORS[status] || "";
      return (
        <Badge variant="outline" className={`${colors} border text-xs`}>
          {status}
        </Badge>
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
      return format(new Date(date), "dd MMM yyyy");
    },
  },
  {
    accessorKey: "transactionId",
    header: "Transaction ID",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.transactionId || "--"}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs">
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/invoices/${row.original.invoice.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View Invoice
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// ============================================================
// PaymentsTable Component
// ============================================================

interface PaymentsTableProps {
  data: PaymentRow[];
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

export function PaymentsTable({ data }: PaymentsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="receiptNumber"
      searchPlaceholder="Search payments..."
      toolbarExtra={<ExportButton />}
    />
  );
}
