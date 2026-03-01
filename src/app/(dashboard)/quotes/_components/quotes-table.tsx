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
  ArrowRightLeftIcon,
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
import { QUOTE_STATUS_COLORS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { sendQuote, deleteQuote, convertToInvoice } from "@/actions/quote.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// ============================================================
// Types
// ============================================================

type QuoteRow = {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  validUntil: Date | string;
  totalAmount: number | string | { toString(): string };
  createdAt: Date | string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    company?: string | null;
  };
  lead?: {
    id: string;
    title: string;
  } | null;
};

// ============================================================
// Columns
// ============================================================

function useColumns(): ColumnDef<QuoteRow, unknown>[] {
  const router = useRouter();

  const handleSend = async (id: string) => {
    const result = await sendQuote(id);
    if (result.success) {
      toast.success("Quote sent successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to send quote");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this draft quote?")) return;
    const result = await deleteQuote(id);
    if (result.success) {
      toast.success("Quote deleted");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to delete quote");
    }
  };

  const handleConvert = async (id: string) => {
    if (!confirm("Convert this quote to an invoice? This action cannot be undone.")) return;
    const result = await convertToInvoice(id);
    if (result.success && result.data) {
      toast.success(`Quote converted to Invoice ${result.data.invoiceNumber}`);
      router.push(`/invoices/${result.data.invoiceId}`);
    } else {
      toast.error(result.error || "Failed to convert quote");
    }
  };

  return [
    {
      accessorKey: "quoteNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Quote #" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/quotes/${row.original.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.original.quoteNumber}
        </Link>
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Title" />
      ),
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block">
          {row.original.title}
        </span>
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
      accessorKey: "validUntil",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Valid Until" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.validUntil);
        const isExpired = date < new Date() && row.original.status !== "CONVERTED";
        return (
          <span className={isExpired ? "text-red-600 font-medium" : ""}>
            {format(date, "dd MMM yyyy")}
          </span>
        );
      },
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const colors = QUOTE_STATUS_COLORS[status] || "";
        return (
          <Badge variant="outline" className={`${colors} border`}>
            {status.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) =>
        format(new Date(row.original.createdAt), "dd MMM yyyy"),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const quote = row.original;
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
                <Link href={`/quotes/${quote.id}`}>
                  <EyeIcon className="mr-2 size-4" />
                  View
                </Link>
              </DropdownMenuItem>
              {quote.status === "DRAFT" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={`/quotes/${quote.id}/edit`}>
                      <PencilIcon className="mr-2 size-4" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSend(quote.id)}>
                    <SendIcon className="mr-2 size-4" />
                    Send Quote
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(quote.id)}
                    className="text-red-600"
                  >
                    <Trash2Icon className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
              {(quote.status === "SENT" ||
                quote.status === "VIEWED" ||
                quote.status === "ACCEPTED") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleConvert(quote.id)}>
                    <ArrowRightLeftIcon className="mr-2 size-4" />
                    Convert to Invoice
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
// QuotesTable Component
// ============================================================

interface QuotesTableProps {
  data: QuoteRow[];
}

export function QuotesTable({ data }: QuotesTableProps) {
  const columns = useColumns();

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="quoteNumber"
      searchPlaceholder="Search quotes..."
    />
  );
}
