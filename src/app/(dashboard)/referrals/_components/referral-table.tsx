"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { EyeIcon, MoreHorizontalIcon, StarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { REFERRAL_STATUS_COLORS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

type ReferralRow = {
  id: string;
  referredName: string;
  referredEmail: string | null;
  referredPhone: string | null;
  status: string;
  rewardPoints: number | null;
  convertedLeadId: string | null;
  notes: string | null;
  referralCode: string | null;
  source: string;
  createdAt: string;
  referrerContact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
};

// ============================================================
// Columns Definition
// ============================================================

const columns: ColumnDef<ReferralRow, unknown>[] = [
  {
    id: "referrerName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Referrer" />
    ),
    accessorFn: (row) =>
      `${row.referrerContact.firstName} ${row.referrerContact.lastName}`,
    cell: ({ row }) => {
      const contact = row.original.referrerContact;
      return (
        <Link
          href={`/contacts/${contact.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {contact.firstName} {contact.lastName}
        </Link>
      );
    },
  },
  {
    accessorKey: "referredName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Referred Person" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/referrals/${row.original.id}`}
        className="font-medium text-blue-600 hover:underline"
      >
        {row.original.referredName}
      </Link>
    ),
  },
  {
    accessorKey: "referralCode",
    header: "Code",
    cell: ({ row }) => {
      const code = row.original.referralCode;
      if (!code) return <span className="text-muted-foreground">--</span>;
      return (
        <span className="font-mono text-xs font-medium tracking-wider">
          {code}
        </span>
      );
    },
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <span className="text-sm capitalize">
        {row.original.source.toLowerCase().replace("_", " ")}
      </span>
    ),
    filterFn: (row, id, value) => {
      return value === "ALL" || row.getValue(id) === value;
    },
  },
  {
    id: "contact",
    header: "Email / Phone",
    cell: ({ row }) => {
      const email = row.original.referredEmail;
      const phone = row.original.referredPhone;
      if (!email && !phone)
        return <span className="text-muted-foreground">--</span>;
      return (
        <div className="text-sm">
          {email && <div>{email}</div>}
          {phone && (
            <div className="text-muted-foreground">{phone}</div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.status}
        colorMap={REFERRAL_STATUS_COLORS}
      />
    ),
    filterFn: (row, id, value) => {
      return value === "ALL" || row.getValue(id) === value;
    },
  },
  {
    accessorKey: "rewardPoints",
    header: "Reward Points",
    cell: ({ row }) => {
      const points = row.original.rewardPoints;
      if (!points)
        return <span className="text-muted-foreground">--</span>;
      return (
        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
          <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
          {points}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {format(new Date(row.original.createdAt), "dd MMM yyyy")}
      </span>
    ),
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
            <Link href={`/referrals/${row.original.id}`}>
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
// ReferralTable Component
// ============================================================

interface ReferralTableProps {
  data: ReferralRow[];
}

export function ReferralTable({ data }: ReferralTableProps) {
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const filteredData = React.useMemo(() => {
    if (statusFilter === "ALL") return data;
    return data.filter((row) => row.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <DataTable
      columns={columns}
      data={filteredData}
      searchKey="referredName"
      searchPlaceholder="Search by referred person name..."
      toolbarExtra={
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="CONTACTED">Contacted</SelectItem>
            <SelectItem value="LEAD_CREATED">Lead Created</SelectItem>
            <SelectItem value="BOOKING_CONFIRMED">Booking Confirmed</SelectItem>
            <SelectItem value="CONVERTED">Converted</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}
