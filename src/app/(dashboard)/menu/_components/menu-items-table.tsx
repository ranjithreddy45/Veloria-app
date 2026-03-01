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
import { deleteMenuItem } from "@/actions/menu.actions";
import { formatINR } from "@/lib/utils";

// ============================================================
// MenuItem Type (matching serialized Prisma MenuItem)
// ============================================================

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  dietaryTags: string[];
  pricePerHead: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ item }: { item: MenuItem }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteMenuItem(item.id);
    if (result.success) {
      toast.success("Menu item deleted successfully");
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
            <Link href={`/menu/${item.id}/edit`}>
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
          <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
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

const columns: ColumnDef<MenuItem>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div>
          <span className="font-medium">{item.name}</span>
          {item.description && (
            <p className="text-muted-foreground text-xs line-clamp-1">
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
      <Badge variant="outline" className="text-xs">
        {row.getValue("category")}
      </Badge>
    ),
  },
  {
    accessorKey: "cuisine",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cuisine" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">
        {row.getValue("cuisine") || "--"}
      </span>
    ),
  },
  {
    accessorKey: "pricePerHead",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price/Head" />
    ),
    cell: ({ row }) => (
      <span className="text-sm font-medium">
        {formatINR(row.getValue("pricePerHead"))}
      </span>
    ),
  },
  {
    accessorKey: "dietaryTags",
    header: "Dietary Tags",
    cell: ({ row }) => {
      const tags = row.getValue("dietaryTags") as string[];
      if (!tags || tags.length === 0) return "--";
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean;
      return (
        <Badge
          variant="outline"
          className={
            isActive
              ? "border-green-200 bg-green-100 text-green-800"
              : "border-gray-200 bg-gray-100 text-gray-800"
          }
        >
          {isActive ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell item={row.original} />,
  },
];

// ============================================================
// MenuItemsTable Component
// ============================================================

interface MenuItemsTableProps {
  data: MenuItem[];
}

export function MenuItemsTable({ data }: MenuItemsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search menu items by name..."
    />
  );
}
