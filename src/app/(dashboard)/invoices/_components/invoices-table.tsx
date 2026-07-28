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
  FileTextIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
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
import { formatINR } from "@/lib/utils";
import { sendInvoice, deleteInvoice } from "@/actions/invoice.actions";
import { exportInvoices } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

export type InvoiceRow = {
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
// Status presentation
// ============================================================

const INVOICE_STATUS_HUE: Record<string, Hue> = {
  DRAFT: "slate",
  SENT: "blue",
  PARTIALLY_PAID: "amber",
  PAID: "emerald",
  OVERDUE: "rose",
  CANCELLED: "neutral",
  REFUNDED: "violet",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
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
          className="numeric text-[13px] font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
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
      accessorKey: "booking",
      header: "Booking",
      cell: ({ row }) => {
        const b = row.original.booking;
        if (!b) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="min-w-0">
            <div className="numeric text-[12.5px]">{b.bookingNumber}</div>
            <div className="truncate text-[12px] text-muted-foreground">
              {b.eventName}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Issue Date" />
      ),
      cell: ({ row }) => (
        <span className="numeric text-[12.5px] text-muted-foreground">
          {row.original.issueDate
            ? format(new Date(row.original.issueDate), "dd MMM yyyy")
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due Date" />
      ),
      cell: ({ row }) => (
        <span className="numeric text-[12.5px] text-muted-foreground">
          {row.original.dueDate
            ? format(new Date(row.original.dueDate), "dd MMM yyyy")
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="Total" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="numeric text-right text-[13px] font-semibold text-foreground">
          {formatINR(row.original.totalAmount)}
        </div>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: () => <div className="text-right">Paid</div>,
      cell: ({ row }) => {
        const paid = Number(row.original.paidAmount?.toString() ?? 0);
        return (
          <div
            className={
              paid > 0
                ? "numeric text-right text-[13px] text-success"
                : "numeric text-right text-[13px] text-muted-foreground"
            }
          >
            {formatINR(row.original.paidAmount)}
          </div>
        );
      },
    },
    {
      accessorKey: "balanceDue",
      header: () => <div className="text-right">Balance</div>,
      cell: ({ row }) => {
        const balance = Number(row.original.balanceDue?.toString() ?? 0);
        return (
          <div
            className={
              balance > 0
                ? "numeric text-right text-[13px] font-semibold text-destructive"
                : "numeric text-right text-[13px] text-muted-foreground"
            }
          >
            {formatINR(row.original.balanceDue)}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <StatusPill
            label={INVOICE_STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
            hue={INVOICE_STATUS_HUE[status] ?? "neutral"}
          />
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
                    className="text-destructive focus:text-destructive"
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

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border bg-card shadow-card">
        <EmptyState
          icon={<FileTextIcon className="size-5" />}
          title="No invoices found"
          description="No invoices match the current filters. Adjust the filters or create a new invoice to get started."
        />
      </div>
    );
  }

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
