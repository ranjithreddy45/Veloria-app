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
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
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
import { deleteResource } from "@/actions/resource.actions";
import { RESOURCE_TYPE_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

// ============================================================
// Resource Type (matching Prisma Resource model)
// ============================================================

interface Resource {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isAvailable: boolean;
  hourlyRate: number | null;
  createdAt: string;
  _count: {
    allocations: number;
  };
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ resource }: { resource: Resource }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteResource(resource.id);
    if (result.success) {
      toast.success("Resource deleted successfully");
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
            <Link href={`/resources/${resource.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/resources/${resource.id}/edit`}>
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
          <AlertDialogTitle>Delete Resource</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{resource.name}</span>? This action
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

const columns: ColumnDef<Resource>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const resource = row.original;
      return (
        <div>
          <Link
            href={`/resources/${resource.id}`}
            className="font-medium hover:underline"
          >
            {resource.name}
          </Link>
          {resource.description && (
            <p className="text-muted-foreground text-xs truncate max-w-[200px]">
              {resource.description}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {RESOURCE_TYPE_LABELS[row.getValue("type") as string] ??
          row.getValue("type")}
      </Badge>
    ),
  },
  {
    accessorKey: "hourlyRate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hourly Rate" />
    ),
    cell: ({ row }) => {
      const rate = row.getValue("hourlyRate") as number | null;
      return (
        <span className="text-sm">
          {rate !== null && rate !== undefined ? formatINR(rate) : "--"}
        </span>
      );
    },
  },
  {
    accessorKey: "isAvailable",
    header: "Available",
    cell: ({ row }) => {
      const available = row.getValue("isAvailable") as boolean;
      return available ? (
        <div className="flex items-center gap-1.5 text-sm text-green-700">
          <CheckCircleIcon className="size-4" />
          Yes
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm text-red-600">
          <XCircleIcon className="size-4" />
          No
        </div>
      );
    },
  },
  {
    accessorKey: "_count.allocations",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Allocations" />
    ),
    cell: ({ row }) => {
      const count = row.original._count.allocations;
      return <span className="text-sm">{count}</span>;
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell resource={row.original} />,
  },
];

// ============================================================
// ResourcesTable Component
// ============================================================

interface ResourcesTableProps {
  data: Resource[];
}

export function ResourcesTable({ data }: ResourcesTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search resources by name..."
    />
  );
}
