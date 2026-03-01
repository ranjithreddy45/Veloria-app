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
  AlertTriangleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { deleteItem } from "@/actions/inventory.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// InventoryItem Type
// ============================================================

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  description: string | null;
  totalQuantity: number;
  availableQty: number;
  reorderLevel: number;
  unitCost: number | null;
  location: string | null;
  isActive: boolean;
  _count: {
    reservations: number;
  };
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ item }: { item: InventoryItem }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteItem(item.id);
    if (result.success) {
      toast.success("Item deleted successfully");
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
            <Link href={`/inventory/${item.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/inventory/${item.id}/edit`}>
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
          <AlertDialogTitle>Delete Item</AlertDialogTitle>
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

const columns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      const isLowStock = item.availableQty <= item.reorderLevel;
      return (
        <div className="flex items-center gap-2">
          <Link
            href={`/inventory/${item.id}`}
            className="font-medium hover:underline"
          >
            {item.name}
          </Link>
          {isLowStock && (
            <AlertTriangleIcon className="size-4 text-amber-500" />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "sku",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="SKU" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-sm">
        {row.getValue("sku") || "--"}
      </span>
    ),
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
    id: "stock",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total / Available" />
    ),
    accessorFn: (row) => row.availableQty,
    cell: ({ row }) => {
      const item = row.original;
      const percent =
        item.totalQuantity > 0
          ? Math.round((item.availableQty / item.totalQuantity) * 100)
          : 0;
      const isLowStock = item.availableQty <= item.reorderLevel;

      return (
        <div className="w-32 space-y-1">
          <div className="flex justify-between text-xs">
            <span className={isLowStock ? "font-semibold text-amber-600" : ""}>
              {item.availableQty} / {item.totalQuantity}
            </span>
            <span className="text-muted-foreground">{percent}%</span>
          </div>
          <Progress
            value={percent}
            className={`h-1.5 ${
              isLowStock
                ? "[&>[data-slot=progress-indicator]]:bg-amber-500"
                : ""
            }`}
          />
        </div>
      );
    },
  },
  {
    accessorKey: "reorderLevel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reorder Level" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("reorderLevel")}</span>
    ),
  },
  {
    accessorKey: "unitCost",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Unit Cost" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {row.getValue("unitCost") != null
          ? formatINR(row.getValue("unitCost"))
          : "--"}
      </span>
    ),
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {row.getValue("location") || "--"}
      </span>
    ),
  },
  {
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) => (
      <Badge
        variant={row.getValue("isActive") ? "default" : "secondary"}
        className="text-xs"
      >
        {row.getValue("isActive") ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell item={row.original} />,
  },
];

// ============================================================
// InventoryTable Component
// ============================================================

interface InventoryTableProps {
  data: InventoryItem[];
}

export function InventoryTable({ data }: InventoryTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search items by name..."
    />
  );
}
