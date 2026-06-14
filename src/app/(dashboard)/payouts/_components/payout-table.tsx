"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { EyeIcon, MoreHorizontalIcon, WalletIcon } from "lucide-react";

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
        className="font-medium font-mono text-blue-600 hover:underline"
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
      const typeColors: Record<string, string> = {
        VENDOR_PAYMENT: "bg-purple-100 text-purple-800 border-purple-200",
        OWNER_PAYOUT: "bg-indigo-100 text-indigo-800 border-indigo-200",
        COMMISSION: "bg-cyan-100 text-cyan-800 border-cyan-200",
      };
      return (
        <Badge
          variant="outline"
          className={`${typeColors[type] || ""} border text-xs`}
        >
          {PAYOUT_TYPE_LABELS[type] || type}
        </Badge>
      );
    },
  },
  {
    id: "vendor",
    header: "Vendor",
    cell: ({ row }) => {
      const vendor = row.original.vendor;
      if (!vendor) return <span className="text-muted-foreground">--</span>;
      return (
        <Link
          href={`/vendors/${vendor.id}`}
          className="text-sm text-blue-600 hover:underline"
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
      if (!booking) return <span className="text-muted-foreground">--</span>;
      return (
        <Link
          href={`/bookings/${booking.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          {booking.bookingNumber}
        </Link>
      );
    },
  },
  {
    accessorKey: "amount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
        {formatINR(row.original.amount)}
      </span>
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
      if (!paidAt) return <span className="text-muted-foreground">--</span>;
      return (
        <span className="text-sm">
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
      <div className="rounded-xl border border-border/70 bg-card shadow-card">
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
