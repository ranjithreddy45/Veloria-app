"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteBudget } from "@/actions/forecast.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// BudgetItem Type
// ============================================================

interface BudgetItem {
  id: string;
  name: string;
  venueId: string | null;
  month: string;
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  category: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ budget }: { budget: BudgetItem }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteBudget(budget.id);
    if (result.success) {
      toast.success("Budget deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs">
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/analytics/budget/${budget.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialogTrigger asChild>
            <DropdownMenuItem className="text-destructive">
              <TrashIcon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Budget</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{budget.name}</span>? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================
// Columns Definition
// ============================================================

const columns: ColumnDef<BudgetItem>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("name")}</span>
    ),
  },
  {
    accessorKey: "month",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Month" />
    ),
    cell: ({ row }) => {
      const month = row.getValue("month") as string;
      const [year, mon] = month.split("-");
      const date = new Date(parseInt(year), parseInt(mon) - 1);
      return (
        <span className="numeric text-[13px] text-muted-foreground">
          {date.toLocaleString("en-IN", { month: "short", year: "numeric" })}
        </span>
      );
    },
  },
  {
    accessorKey: "revenue",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Revenue" />
    ),
    cell: ({ row }) => (
      <span className="numeric font-medium text-emerald-700 dark:text-emerald-400">
        {formatINR(row.getValue("revenue"))}
      </span>
    ),
  },
  {
    accessorKey: "expenses",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expenses" />
    ),
    cell: ({ row }) => (
      <span className="numeric font-medium text-rose-700 dark:text-rose-400">
        {formatINR(row.getValue("expenses"))}
      </span>
    ),
  },
  {
    accessorKey: "profit",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Profit" />
    ),
    cell: ({ row }) => {
      const profit = row.getValue("profit") as number;
      return (
        <span
          className={`numeric font-medium ${
            profit >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          }`}
        >
          {formatINR(profit)}
        </span>
      );
    },
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => {
      const category = row.getValue("category") as string | null;
      return category ? (
        <Badge variant="secondary" className="text-[11px] font-medium">
          {category}
        </Badge>
      ) : (
        <span className="text-[13px] text-muted-foreground">--</span>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell budget={row.original} />,
  },
];

// ============================================================
// BudgetTable Component
// ============================================================

interface BudgetTableProps {
  data: BudgetItem[];
}

export function BudgetTable({ data }: BudgetTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search budgets by name..."
    />
  );
}
