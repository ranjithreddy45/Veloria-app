"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  DownloadIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { INVOICE_STATUS_COLORS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { sendInvoice, deleteInvoice } from "@/actions/invoice.actions";
import { exportInvoices } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date | string;
  dueDate: Date | string;
  totalAmount: number | string | { toString(): string };
  paidAmount: number | string | { toString(): string };
  balanceDue: number | string | { toString(): string };
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    company?: string | null;
  };
  booking?: {
    id: string;
    bookingNumber: string;
    eventName: string;
  } | null;
};

// ============================================================
// Columns
// ============================================================

function useColumns(): ColumnDef<InvoiceRow, unknown>[] {
  const router = useRouter();

  const handleSend = async (id: string) => {
    const result = await sendInvoice(id);
    if (result.success) {
      toast.success("Invoice sent successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to send invoice");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft invoice?")) return;
    const result = await deleteInvoice(id);
    if (result.success) {
      toast.success("Invoice deleted");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete invoice");
    }
  };

  return [
    {
      accessorKey: "invoiceNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice #" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/invoices/${row.original.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    {
      accessorKey: "contact",
      header: "Contact",
      cell: ({ row }) => {
        const c = row.original.contact;
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
      accessorKey: "booking",
      header: "Booking",
      cell: ({ row }) => {
        const b = row.original.booking;
        if (!b) return <span className="text-muted-foreground">--</span>;
        return (
          <div>
            <div className="text-sm">{b.bookingNumber}</div>
            <div className="text-xs text-muted-foreground">{b.eventName}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Issue Date" />
      ),
      cell: ({ row }) =>
        format(new Date(row.original.issueDate), "dd MMM yyyy"),
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row }) =>
        format(new Date(row.original.dueDate), "dd MMM yyyy"),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{formatINR(row.original.totalAmount)}</span>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: "Paid",
      cell: ({ row }) => (
        <span className="text-green-700">
          {formatINR(row.original.paidAmount)}
        </span>
      ),
    },
    {
      accessorKey: "balanceDue",
      header: "Balance",
      cell: ({ row }) => {
        const balance = Number(row.original.balanceDue?.toString() ?? 0);
        return (
          <span className={balance > 0 ? "font-medium text-red-600" : ""}>
            {formatINR(row.original.balanceDue)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const colors = INVOICE_STATUS_COLORS[status] || "";
        return (
          <Badge variant="outline" className={`${colors} border`}>
            {status.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/invoices/${invoice.id}`}>
                  <EyeIcon className="mr-2 size-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {invoice.status === "DRAFT" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/invoices/${invoice.id}/edit`}>
                      <PencilIcon className="mr-2 size-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSend(invoice.id)}>
                    <SendIcon className="mr-2 size-4" />
                    Send Invoice
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(invoice.id)}
                    className="text-red-600"
                  >
                    <Trash2Icon className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

// ============================================================
// InvoicesTable Component
// ============================================================

interface InvoicesTableProps {
  data: InvoiceRow[];
}

function ExportButton() {
  const [loading, setLoading] = React.useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportInvoices();
      if (result.success) {
        const csv = toCSV(result.data.headers, result.data.rows);
        downloadCSV(`invoices-${new Date().toISOString().split("T")[0]}.csv`, csv);
        toast.success("Invoices exported successfully");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to export invoices");
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

export function InvoicesTable({ data }: InvoicesTableProps) {
  const columns = useColumns();

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="invoiceNumber"
      searchPlaceholder="Search invoices..."
      toolbarExtra={<ExportButton />}
    />
  );
}
