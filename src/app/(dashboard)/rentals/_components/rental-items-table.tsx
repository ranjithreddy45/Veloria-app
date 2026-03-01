"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
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
import { deleteRentalItem } from "@/actions/rental.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// Rental Item Type
// ============================================================

interface RentalItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  dailyRate: number;
  weeklyRate: number | null;
  quantity: number;
  availableQty: number;
  condition: string | null;
  imageUrl: string | null;
  _count: {
    rentals: number;
  };
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ item }: { item: RentalItem }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteRentalItem(item.id);
    if (result.success) {
      toast.success("Rental item deleted successfully");
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
            <Link href={`/rentals/${item.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/rentals/${item.id}/edit`}>
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
          <AlertDialogTitle>Delete Rental Item</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{item.name}</span>? This action
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

const columns: ColumnDef<RentalItem>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div>
          <Link
            href={`/rentals/${item.id}`}
            className="font-medium hover:underline"
          >
            {item.name}
          </Link>
          {item.description && (
            <p className="text-muted-foreground max-w-[200px] truncate text-xs">
              {item.description}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "category",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {row.getValue("category")}
      </Badge>
    ),
  },
  {
    accessorKey: "dailyRate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Daily Rate" />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {formatINR(row.getValue("dailyRate"))}
      </span>
    ),
  },
  {
    accessorKey: "weeklyRate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Weekly Rate" />
    ),
    cell: ({ row }) => {
      const weeklyRate = row.getValue("weeklyRate") as number | null;
      return (
        <span className="text-muted-foreground text-sm">
          {weeklyRate ? formatINR(weeklyRate) : "--"}
        </span>
      );
    },
  },
  {
    id: "availability",
    header: "Available / Total",
    cell: ({ row }) => {
      const item = row.original;
      const isLow = item.availableQty <= Math.ceil(item.quantity * 0.2);
      return (
        <span
          className={`text-sm font-medium ${
            isLow ? "text-red-600" : "text-green-600"
          }`}
        >
          {item.availableQty} / {item.quantity}
        </span>
      );
    },
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.getValue("condition") || "--"}
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell item={row.original} />,
  },
];

// ============================================================
// RentalItemsTable Component
// ============================================================

interface RentalItemsTableProps {
  data: RentalItem[];
}

export function RentalItemsTable({ data }: RentalItemsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search rental items..."
    />
  );
}
