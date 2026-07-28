"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { deleteWebform, toggleWebform } from "@/actions/webform.actions";
import { formatDate } from "@/lib/utils";

// ============================================================
// Webform Type
// ============================================================

interface Webform {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  fields: unknown[];
  isActive: boolean;
  createdAt: string;
  _count: {
    submissions: number;
  };
}

// ============================================================
// Active Toggle Cell
// ============================================================

function ActiveToggle({ webform }: { webform: Webform }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleToggle = async () => {
    setPending(true);
    try {
      const result = await toggleWebform(webform.id);
      if (result.success) {
        toast.success(
          result.data.isActive ? "Webform activated" : "Webform deactivated"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to toggle webform");
    } finally {
      setPending(false);
    }
  };

  return (
    <Switch
      checked={webform.isActive}
      onCheckedChange={handleToggle}
      disabled={pending}
      aria-label={
        webform.isActive ? "Deactivate webform" : "Activate webform"
      }
    />
  );
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ webform }: { webform: Webform }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteWebform(webform.id);
    if (result.success) {
      toast.success("Webform deleted successfully");
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
            <Link href={`/settings/webforms/${webform.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/settings/webforms/${webform.id}`}>
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
          <AlertDialogTitle>Delete Webform</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{webform.name}</span>? This action
            cannot be undone. All submissions will also be deleted.
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

const columns: ColumnDef<Webform>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const webform = row.original;
      return (
        <Link
          href={`/settings/webforms/${webform.id}`}
          className="font-medium hover:underline"
        >
          {webform.name}
        </Link>
      );
    },
  },
  {
    accessorKey: "slug",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Slug" />
    ),
    cell: ({ row }) => (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
        {row.getValue("slug")}
      </code>
    ),
  },
  {
    id: "active",
    header: "Status",
    cell: ({ row }) => <ActiveToggle webform={row.original} />,
  },
  {
    id: "fieldsCount",
    header: "Fields",
    cell: ({ row }) => {
      const fields = row.original.fields;
      return (
        <Badge variant="secondary" className="text-xs">
          {Array.isArray(fields) ? fields.length : 0}
        </Badge>
      );
    },
  },
  {
    id: "submissionsCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submissions" />
    ),
    accessorFn: (row) => row._count.submissions,
    cell: ({ row }) => (
      <span className="text-sm">{row.original._count.submissions}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDate(row.getValue("createdAt"))}
      </span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell webform={row.original} />,
  },
];

// ============================================================
// WebformsTable Component
// ============================================================

interface WebformsTableProps {
  data: Webform[];
}

export function WebformsTable({ data }: WebformsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search webforms by name..."
    />
  );
}
