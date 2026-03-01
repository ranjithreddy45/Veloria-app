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
  SendIcon,
  CalendarIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
import {
  deleteCampaign,
  sendCampaign,
  cancelCampaign,
} from "@/actions/campaign.actions";
import { CAMPAIGN_STATUS_COLORS } from "@/lib/constants";

// ============================================================
// Campaign Type
// ============================================================

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  createdAt: string;
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const handleDelete = async () => {
    setIsPending(true);
    const result = await deleteCampaign(campaign.id);
    if (result.success) {
      toast.success("Campaign deleted successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsPending(false);
  };

  const handleSend = async () => {
    setIsPending(true);
    const result = await sendCampaign(campaign.id);
    if (result.success) {
      toast.success("Campaign sent successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsPending(false);
  };

  const handleCancel = async () => {
    setIsPending(true);
    const result = await cancelCampaign(campaign.id);
    if (result.success) {
      toast.success("Campaign cancelled");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsPending(false);
  };

  const isDraft = campaign.status === "DRAFT";
  const canSend = isDraft || campaign.status === "SCHEDULED";
  const canCancel =
    campaign.status !== "SENT" && campaign.status !== "CANCELLED";

  return (
    <AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" disabled={isPending}>
            <MoreHorizontalIcon className="size-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/campaigns/${campaign.id}`}>
              <EyeIcon className="mr-2 size-4" />
              View
            </Link>
          </DropdownMenuItem>
          {isDraft && (
            <DropdownMenuItem asChild>
              <Link href={`/campaigns/${campaign.id}/edit`}>
                <PencilIcon className="mr-2 size-4" />
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          {canSend && (
            <DropdownMenuItem onClick={handleSend}>
              <SendIcon className="mr-2 size-4" />
              Send Now
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem onClick={handleCancel}>
              <XCircleIcon className="mr-2 size-4" />
              Cancel
            </DropdownMenuItem>
          )}
          {isDraft && (
            <>
              <DropdownMenuSeparator />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive">
                  <TrashIcon className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </AlertDialogTrigger>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{campaign.name}</span>? This action
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

const columns: ColumnDef<Campaign>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const campaign = row.original;
      return (
        <Link
          href={`/campaigns/${campaign.id}`}
          className="font-medium hover:underline"
        >
          {campaign.name}
        </Link>
      );
    },
  },
  {
    accessorKey: "subject",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subject" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground max-w-[200px] truncate block">
        {row.getValue("subject")}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        status={row.getValue("status")}
        colorMap={CAMPAIGN_STATUS_COLORS}
      />
    ),
  },
  {
    id: "sent",
    header: "Sent",
    cell: ({ row }) => {
      const campaign = row.original;
      return (
        <span className="text-muted-foreground">
          {campaign.totalSent > 0
            ? campaign.totalSent.toLocaleString("en-IN")
            : "--"}
        </span>
      );
    },
  },
  {
    id: "opened",
    header: "Opened",
    cell: ({ row }) => {
      const campaign = row.original;
      return (
        <span className="text-muted-foreground">
          {campaign.totalOpened > 0
            ? campaign.totalOpened.toLocaleString("en-IN")
            : "--"}
        </span>
      );
    },
  },
  {
    id: "clicked",
    header: "Clicked",
    cell: ({ row }) => {
      const campaign = row.original;
      return (
        <span className="text-muted-foreground">
          {campaign.totalClicked > 0
            ? campaign.totalClicked.toLocaleString("en-IN")
            : "--"}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) =>
      format(new Date(row.getValue("createdAt")), "dd MMM yyyy"),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell campaign={row.original} />,
  },
];

// ============================================================
// CampaignTable Component
// ============================================================

interface CampaignTableProps {
  data: Campaign[];
}

export function CampaignTable({ data }: CampaignTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search campaigns by name..."
    />
  );
}
