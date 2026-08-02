"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { EyeIcon, MoreHorizontalIcon, WalletIcon } from "lucide-react";

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
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { PAYOUT_TYPE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

export type PayoutRow = {
  id: string;
  referenceNumber: string | null;
  amount: number;
  status: string;
  type: string;
  description: string | null;
  paidAt: string | null;
  createdAt: string;
  vendor: {
    id: string;
    name: string;
  } | null;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
  } | null;
};

// ============================================================
// Status presentation
// ============================================================

const PAYOUT_STATUS_HUE: Record<string, Hue> = {
  PENDING: "amber",
  APPROVED: "blue",
  PAID: "emerald",
  CANCELLED: "rose",
};

const PAYOUT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

// ============================================================
// Columns Definition
// ============================================================

const columns: ColumnDef<PayoutRow, unknown>[] = [
  {
    accessorKey: "referenceNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reference #" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/payouts/${row.original.id}`}
        className="numeric text-body font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
      >
        {row.original.referenceNumber || row.original.id.slice(0, 8)}
      </Link>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.original.type;
      const typeHue: Record<string, Hue> = {
        VENDOR_PAYMENT: "purple",
        OWNER_PAYOUT: "indigo",
        COMMISSION: "cyan",
      };
      return (
        <StatusPill
          label={PAYOUT_TYPE_LABELS[type] || type}
          hue={typeHue[type] ?? "neutral"}
          size="xs"
          noDot
        />
      );
    },
  },
  {
    id: "vendor",
    header: "Vendor",
    cell: ({ row }) => {
      const vendor = row.original.vendor;
      if (!vendor) return <span className="text-muted-foreground">—</span>;
      return (
        <Link
          href={`/vendors/${vendor.id}`}
          className="text-body font-medium underline-offset-4 hover:text-primary hover:underline"
        >
          {vendor.name}
        </Link>
      );
    },
  },
  {
    id: "booking",
    header: "Booking",
    cell: ({ row }) => {
      const booking = row.original.booking;
      if (!booking) return <span className="text-muted-foreground">—</span>;
      return (
        <Link
          href={`/bookings/${booking.id}`}
          className="numeric text-detail underline-offset-4 hover:text-primary hover:underline"
        >
          {booking.bookingNumber}
        </Link>
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
          row.original.status === "PAID"
            ? "numeric text-right text-body font-semibold text-success"
            : "numeric text-right text-body font-semibold text-foreground"
        }
      >
        {formatINR(row.original.amount)}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusPill
        label={
          PAYOUT_STATUS_LABEL[row.original.status] ?? row.original.status
        }
        hue={PAYOUT_STATUS_HUE[row.original.status] ?? "neutral"}
      />
    ),
  },
  {
    accessorKey: "paidAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Paid At" />
    ),
    cell: ({ row }) => {
      const paidAt = row.original.paidAt;
      if (!paidAt) return <span className="text-muted-foreground">—</span>;
      return (
        <span className="numeric text-detail text-muted-foreground">
          {format(new Date(paidAt), "dd MMM yyyy")}
        </span>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
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
            <Link href={`/payouts/${row.original.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View Details
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// ============================================================
// PayoutTable Component
// ============================================================

interface PayoutTableProps {
  data: PayoutRow[];
  isFiltered?: boolean;
}

export function PayoutTable({ data, isFiltered }: PayoutTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border bg-card shadow-card">
        <EmptyState
          icon={<WalletIcon className="size-5" />}
          title={isFiltered ? "No payouts match the current filters" : "No payouts found"}
          description={
            isFiltered
              ? "Try clearing or widening the filters in the rail to the left."
              : "Vendor payments, owner payouts, and commissions will appear here once created."
          }
        />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="referenceNumber"
      searchPlaceholder="Search by reference number..."
    />
  );
}
