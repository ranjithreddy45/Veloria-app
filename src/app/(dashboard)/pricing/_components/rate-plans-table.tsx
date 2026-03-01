"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  StarIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatINR } from "@/lib/utils";
import { updateRatePlan } from "@/actions/pricing.actions";

// ============================================================
// Types
// ============================================================

interface RatePlanRow {
  id: string;
  name: string;
  description: string | null;
  baseRate: number;
  perGuestRate: number;
  isDefault: boolean;
  isActive: boolean;
  venue: { id: string; name: string } | null;
  createdAt: string;
}

interface RatePlansTableProps {
  data: RatePlanRow[];
}

// ============================================================
// RatePlansTable Component
// ============================================================

export function RatePlansTable({ data }: RatePlansTableProps) {
  const router = useRouter();

  const columns: ColumnDef<RatePlanRow, unknown>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Plan Name" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {row.original.name}
          </span>
          {row.original.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <StarIcon className="size-3" />
              Default
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="max-w-[250px] truncate text-sm text-zinc-500 dark:text-zinc-400">
          {row.original.description || "--"}
        </span>
      ),
    },
    {
      accessorKey: "venue",
      header: "Venue",
      cell: ({ row }) => (
        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {row.original.venue?.name || "All Venues"}
        </span>
      ),
    },
    {
      accessorKey: "baseRate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Base Rate" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {formatINR(row.original.baseRate)}
        </span>
      ),
    },
    {
      accessorKey: "perGuestRate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Per Guest" />
      ),
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {formatINR(row.original.perGuestRate)}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.original.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const plan = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/pricing/rate-plans/${plan.id}/edit`}>
                  <PencilIcon className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search rate plans..."
    />
  );
}
