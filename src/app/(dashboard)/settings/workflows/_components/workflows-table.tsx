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
  PlayIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { deleteWorkflow, toggleWorkflow } from "@/actions/workflow.actions";
import { WORKFLOW_TRIGGER_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

// ============================================================
// Workflow Type
// ============================================================

interface Workflow {
  id: string;
  name: string;
  trigger: string;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  isActive: boolean;
  delayMinutes: number | null;
  createdAt: string;
  lastRun: string | null;
  _count: {
    logs: number;
  };
}

// ============================================================
// Active Toggle Cell
// ============================================================

function ActiveToggle({ workflow }: { workflow: Workflow }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleToggle = async () => {
    setPending(true);
    try {
      const result = await toggleWorkflow(workflow.id);
      if (result.success) {
        toast.success(
          result.data.isActive
            ? "Workflow activated"
            : "Workflow deactivated"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to toggle workflow");
    } finally {
      setPending(false);
    }
  };

  return (
    <Switch
      checked={workflow.isActive}
      onCheckedChange={handleToggle}
      disabled={pending}
      aria-label={workflow.isActive ? "Deactivate workflow" : "Activate workflow"}
    />
  );
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ workflow }: { workflow: Workflow }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteWorkflow(workflow.id);
    if (result.success) {
      toast.success("Workflow deleted successfully");
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
            <Link href={`/settings/workflows/${workflow.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/settings/workflows/${workflow.id}/edit`}>
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
          <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{workflow.name}</span>? This action
            cannot be undone. All associated logs will also be deleted.
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
// Action Type Labels
// ============================================================

const ACTION_TYPE_LABELS: Record<string, string> = {
  SEND_EMAIL: "Send Email",
  CREATE_TASK: "Create Task",
  SEND_NOTIFICATION: "Send Notification",
  UPDATE_STATUS: "Update Status",
};

// ============================================================
// Columns Definition
// ============================================================

const columns: ColumnDef<Workflow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const workflow = row.original;
      return (
        <Link
          href={`/settings/workflows/${workflow.id}`}
          className="font-medium hover:underline"
        >
          {workflow.name}
        </Link>
      );
    },
  },
  {
    accessorKey: "trigger",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Trigger" />
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-xs">
        {WORKFLOW_TRIGGER_LABELS[row.getValue("trigger") as string] ??
          row.getValue("trigger")}
      </Badge>
    ),
  },
  {
    id: "actionsCount",
    header: "Actions",
    cell: ({ row }) => {
      const actions = row.original.actions;
      if (!actions || actions.length === 0) return "--";
      return (
        <div className="flex flex-wrap gap-1">
          {actions.slice(0, 2).map((action, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {ACTION_TYPE_LABELS[action.type] ?? action.type}
            </Badge>
          ))}
          {actions.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{actions.length - 2}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    id: "active",
    header: "Active",
    cell: ({ row }) => <ActiveToggle workflow={row.original} />,
  },
  {
    id: "lastRun",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Run" />
    ),
    accessorFn: (row) => row.lastRun,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDate(row.original.lastRun)}
      </span>
    ),
  },
  {
    id: "logsCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Logs" />
    ),
    accessorFn: (row) => row._count.logs,
    cell: ({ row }) => (
      <span className="text-sm">{row.original._count.logs}</span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell workflow={row.original} />,
  },
];

// ============================================================
// WorkflowsTable Component
// ============================================================

interface WorkflowsTableProps {
  data: Workflow[];
}

export function WorkflowsTable({ data }: WorkflowsTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search workflows by name..."
    />
  );
}
