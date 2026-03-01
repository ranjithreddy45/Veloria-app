"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  DownloadIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader, getSelectionColumn } from "@/components/shared/data-table";
import { SavedViewSelector } from "@/components/shared/saved-view-selector";
import {
  BulkActionBar,
  TrashIcon as BulkTrashIcon,
  TagIcon as BulkTagIcon,
} from "@/components/shared/bulk-action-bar";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { deleteLead } from "@/actions/lead.actions";
import { bulkUpdateLeads, bulkDeleteLeads } from "@/actions/bulk.actions";
import { aiScoreAllLeads } from "@/actions/ai.actions";
import { exportLeads } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  LEAD_STATUS_COLORS,
  LEAD_SOURCE_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

// ============================================================
// Lead Source Colors
// ============================================================

const LEAD_SOURCE_COLORS: Record<string, string> = {
  WEBSITE: "bg-blue-100 text-blue-800 border-blue-200",
  REFERRAL: "bg-green-100 text-green-800 border-green-200",
  SOCIAL_MEDIA: "bg-pink-100 text-pink-800 border-pink-200",
  WALK_IN: "bg-amber-100 text-amber-800 border-amber-200",
  PHONE_INQUIRY: "bg-cyan-100 text-cyan-800 border-cyan-200",
  EMAIL: "bg-indigo-100 text-indigo-800 border-indigo-200",
  EVENT: "bg-purple-100 text-purple-800 border-purple-200",
  PARTNER: "bg-teal-100 text-teal-800 border-teal-200",
  ADVERTISEMENT: "bg-orange-100 text-orange-800 border-orange-200",
  OTHER: "bg-muted text-foreground border-border",
};

// ============================================================
// Lead Type with Contact Info
// ============================================================

interface LeadWithContact {
  id: string;
  title: string;
  status: string;
  source: string;
  score: number;
  aiScore: number | null;
  estimatedValue: unknown;
  eventType: string | null;
  eventDate: Date | string | null;
  guestCount: number | null;
  createdAt: Date | string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  assignedTo: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

// ============================================================
// Score Badge Component
// ============================================================

function ScoreBadge({ score }: { score: number }) {
  const colorClass =
    score >= 70
      ? "bg-green-100 text-green-800 border-green-200"
      : score >= 40
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : "bg-red-100 text-red-800 border-red-200";

  return (
    <Badge variant="outline" className={cn("border font-medium", colorClass)}>
      {score}
    </Badge>
  );
}

// ============================================================
// AI Score Badge Component
// ============================================================

function AIScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground text-xs">--</span>;
  }

  const colorClass =
    score >= 70
      ? "bg-green-100 text-green-800 border-green-200"
      : score >= 40
        ? "bg-yellow-100 text-yellow-800 border-yellow-200"
        : "bg-red-100 text-red-800 border-red-200";

  return (
    <Badge variant="outline" className={cn("border font-medium", colorClass)}>
      <SparklesIcon className="mr-1 size-3" />
      {score}
    </Badge>
  );
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ lead }: { lead: LeadWithContact }) {
  const router = useRouter();

  const handleDelete = async () => {
    const result = await deleteLead(lead.id);
    if (result.success) {
      toast.success("Lead deleted successfully");
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
            <Link href={`/leads/${lead.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/leads/${lead.id}`}>
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
          <AlertDialogTitle>Delete Lead</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the lead{" "}
            <span className="font-medium">{lead.title}</span>? This action
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

const columns: ColumnDef<LeadWithContact>[] = [
  getSelectionColumn<LeadWithContact>(),
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <Link
        href={`/leads/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.getValue("title")}
      </Link>
    ),
  },
  {
    id: "contact",
    accessorFn: (row) =>
      `${row.contact.firstName} ${row.contact.lastName}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact" />
    ),
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <Link
          href={`/contacts/${lead.contact.id}`}
          className="text-sm hover:underline"
        >
          {lead.contact.firstName} {lead.contact.lastName}
        </Link>
      );
    },
  },
  {
    accessorKey: "eventType",
    header: "Event Type",
    cell: ({ row }) => row.getValue("eventType") || "--",
  },
  {
    accessorKey: "eventDate",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event Date" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("eventDate");
      return date
        ? format(new Date(date as string), "dd MMM yyyy")
        : "--";
    },
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => {
      const source = row.getValue("source") as string;
      return (
        <StatusBadge
          status={source}
          colorMap={LEAD_SOURCE_COLORS}
          label={LEAD_SOURCE_LABELS[source] ?? source}
        />
      );
    },
  },
  {
    accessorKey: "score",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Score" />
    ),
    cell: ({ row }) => <ScoreBadge score={row.getValue("score")} />,
  },
  {
    accessorKey: "aiScore",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="AI Score" />
    ),
    cell: ({ row }) => <AIScoreBadge score={row.getValue("aiScore")} />,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("status")}
        colorMap={LEAD_STATUS_COLORS}
      />
    ),
  },
  {
    id: "assignedTo",
    accessorFn: (row) => row.assignedTo?.name ?? "",
    header: "Assigned To",
    cell: ({ row }) => {
      const lead = row.original;
      return lead.assignedTo?.name || (
        <span className="text-muted-foreground">Unassigned</span>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell lead={row.original} />,
  },
];

// ============================================================
// LeadsTable Component
// ============================================================

interface LeadsTableProps {
  data: LeadWithContact[];
}

function AIScoreAllButton() {
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleScoreAll() {
    setLoading(true);
    try {
      const result = await aiScoreAllLeads();
      if (result.success) {
        toast.success(`AI scored ${result.data.updatedCount} leads successfully`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to run AI scoring");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleScoreAll} disabled={loading}>
      <SparklesIcon className="mr-2 size-4" />
      {loading ? "Scoring..." : "AI Score All"}
    </Button>
  );
}

function ExportButton() {
  const [loading, setLoading] = React.useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportLeads();
      if (result.success) {
        const csv = toCSV(result.data.headers, result.data.rows);
        downloadCSV(`leads-${new Date().toISOString().split("T")[0]}.csv`, csv);
        toast.success("Leads exported successfully");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to export leads");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <DownloadIcon className="mr-2 size-4" />
      {loading ? "Exporting..." : "Export CSV"}
    </Button>
  );
}

export function LeadsTable({ data }: LeadsTableProps) {
  const router = useRouter();
  const [selectedRows, setSelectedRows] = React.useState<LeadWithContact[]>([]);

  const selectedIds = React.useMemo(
    () => selectedRows.map((r) => r.id),
    [selectedRows]
  );

  const bulkActions = React.useMemo(
    () => [
      {
        id: "mark-contacted",
        label: "Mark Contacted",
        icon: BulkTagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkUpdateLeads({
            ids,
            data: { status: "CONTACTED" },
          });
          if (result.success) {
            toast.success(`Updated ${result.data.count} leads`);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        },
      },
      {
        id: "mark-qualified",
        label: "Mark Qualified",
        icon: BulkTagIcon,
        onClick: async (ids: string[]) => {
          const result = await bulkUpdateLeads({
            ids,
            data: { status: "QUALIFIED" },
          });
          if (result.success) {
            toast.success(`Updated ${result.data.count} leads`);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: BulkTrashIcon,
        variant: "destructive" as const,
        requireConfirm: true,
        confirmTitle: "Delete Leads",
        confirmDescription: `Are you sure you want to delete ${selectedRows.length} lead(s)? This action cannot be undone.`,
        onClick: async (ids: string[]) => {
          const result = await bulkDeleteLeads({ ids });
          if (result.success) {
            toast.success(`Deleted ${result.data.count} leads`);
            router.refresh();
          } else {
            toast.error(result.error);
          }
        },
      },
    ],
    [router, selectedRows.length]
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchKey="title"
        searchPlaceholder="Search leads by title..."
        enableRowSelection
        onSelectionChange={setSelectedRows}
        getRowId={(row) => row.id}
        toolbarExtra={
          <div className="flex items-center gap-2">
            <SavedViewSelector entityType="LEAD" />
            <AIScoreAllButton />
            <ExportButton />
          </div>
        }
      />
      <BulkActionBar
        selectedCount={selectedRows.length}
        selectedIds={selectedIds}
        actions={bulkActions}
        onClearSelection={() => setSelectedRows([])}
      />
    </>
  );
}
