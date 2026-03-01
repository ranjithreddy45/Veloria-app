"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  EyeIcon,
  MoreHorizontalIcon,
  CoinsIcon,
} from "lucide-react";

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
import { LOYALTY_TIER_COLORS } from "@/lib/constants";

// ============================================================
// Types
// ============================================================

type LoyaltyAccountRow = {
  id: string;
  points: number;
  tier: string;
  totalEarned: number;
  totalRedeemed: number;
  createdAt: string;
  updatedAt: string;
  contactId: string;
  contact: {
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

const columns: ColumnDef<LoyaltyAccountRow, unknown>[] = [
  {
    id: "contactName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact" />
    ),
    accessorFn: (row) =>
      `${row.contact.firstName} ${row.contact.lastName}`,
    cell: ({ row }) => {
      const contact = row.original.contact;
      return (
        <div>
          <Link
            href={`/loyalty/${row.original.id}`}
            className="font-medium text-blue-600 hover:underline"
          >
            {contact.firstName} {contact.lastName}
          </Link>
          {contact.email && (
            <p className="text-xs text-muted-foreground">{contact.email}</p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "points",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Points Balance" />
    ),
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
        <CoinsIcon className="size-3.5 text-amber-500" />
        {row.original.points.toLocaleString("en-IN")}
      </span>
    ),
  },
  {
    accessorKey: "tier",
    header: "Tier",
    cell: ({ row }) => (
      <StatusBadge
        status={row.original.tier}
        colorMap={LOYALTY_TIER_COLORS}
      />
    ),
    filterFn: (row, id, value) => {
      return value === "ALL" || row.getValue(id) === value;
    },
  },
  {
    accessorKey: "totalEarned",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Earned" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-emerald-700">
        {row.original.totalEarned.toLocaleString("en-IN")}
      </span>
    ),
  },
  {
    accessorKey: "totalRedeemed",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Redeemed" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-purple-700">
        {row.original.totalRedeemed.toLocaleString("en-IN")}
      </span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Joined" />
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
            <Link href={`/loyalty/${row.original.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View Account
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// ============================================================
// LoyaltyTable Component
// ============================================================

interface LoyaltyTableProps {
  data: LoyaltyAccountRow[];
}

export function LoyaltyTable({ data }: LoyaltyTableProps) {
  const [tierFilter, setTierFilter] = React.useState("ALL");

  const filteredData = React.useMemo(() => {
    if (tierFilter === "ALL") return data;
    return data.filter((row) => row.tier === tierFilter);
  }, [data, tierFilter]);

  return (
    <DataTable
      columns={columns}
      data={filteredData}
      searchKey="contactName"
      searchPlaceholder="Search by contact name..."
      toolbarExtra={
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Tiers</SelectItem>
            <SelectItem value="BRONZE">Bronze</SelectItem>
            <SelectItem value="SILVER">Silver</SelectItem>
            <SelectItem value="GOLD">Gold</SelectItem>
            <SelectItem value="PLATINUM">Platinum</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}
