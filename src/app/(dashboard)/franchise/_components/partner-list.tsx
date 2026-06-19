"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

// ============================================================
// Partner list — client table of FranchisePartner rows
// ============================================================

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
  IN_PROGRESS:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  PENDING_REVIEW:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  ACTIVE:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  SUSPENDED:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
};

interface PartnerRow {
  id: string;
  name: string;
  legalName: string | null;
  status: string;
  createdAt: string;
  ownerUser?: { id: string; name: string | null; email: string } | null;
  _count?: { venues: number; revenueShareConfigs: number };
}

interface PartnerListProps {
  data: PartnerRow[];
}

export function PartnerList({ data }: PartnerListProps) {
  const router = useRouter();

  const columns: ColumnDef<PartnerRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Partner" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/franchise/${row.original.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} colorMap={STATUS_COLORS} />
      ),
    },
    {
      id: "venues",
      header: "Venues",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original._count?.venues ?? 0}</span>
      ),
    },
    {
      id: "owner",
      header: "Owner",
      cell: ({ row }) =>
        row.original.ownerUser?.name ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created" />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.createdAt
            ? format(new Date(row.original.createdAt), "dd MMM yyyy")
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Partners</h2>
        <Button size="sm" variant="outline" onClick={() => router.push("/franchise/new")}>
          <PlusIcon className="mr-1.5 size-3.5" />
          New Partner
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        searchKey="name"
        searchPlaceholder="Search partners..."
      />
    </div>
  );
}
