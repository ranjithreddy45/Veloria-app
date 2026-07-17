"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import {
  MoreHorizontalIcon,
  CheckCircleIcon,
  UserPlusIcon,
  TrashIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  UsersIcon,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  processInquiry,
  markInquiryProcessed,
  deleteInquiry,
} from "@/actions/widget.actions";
import { setEnquiryStatus } from "@/actions/enquiry.actions";
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_LABEL, type EnquiryStatus } from "@/lib/enquiry-status";
import { CrmNotesPanel } from "@/components/crm/crm-notes-panel";
import { ScheduleTaskDialog } from "@/components/crm/schedule-task-dialog";
import { cn } from "@/lib/utils";

// ============================================================
// Inquiry Type
// ============================================================

interface InquiryData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  eventType: string | null;
  eventDate: Date | string | null;
  guestCount: number | null;
  venueId: string | null;
  message: string;
  source: string;
  isProcessed: boolean;
  enquiryStatus?: string | null;
  createdAt: Date | string;
}

// Enquiry outcome: Interested / Dropped / No response.
function EnquiryStatusControl({ inquiry }: { inquiry: InquiryData }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<string | null>(null);
  const current = inquiry.enquiryStatus as EnquiryStatus | null | undefined;
  async function set(status: EnquiryStatus) {
    setSaving(status);
    try {
      const res = await setEnquiryStatus(inquiry.id, current === status ? null : status);
      if (!res.success) { toast.error(res.error); return; }
      toast.success(current === status ? "Status cleared" : `Marked ${ENQUIRY_STATUS_LABEL[status]}`);
      router.refresh();
    } finally { setSaving(null); }
  }
  const tone: Record<EnquiryStatus, string> = {
    LEAD_CREATED: "border-violet-300 bg-violet-50 text-violet-700",
    INTERESTED: "border-emerald-300 bg-emerald-50 text-emerald-700",
    DROPPED: "border-rose-300 bg-rose-50 text-rose-700",
    NO_RESPONSE: "border-amber-300 bg-amber-50 text-amber-700",
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-zinc-700">Status:</span>
      {ENQUIRY_STATUSES.map((s) => (
        <Button
          key={s}
          size="sm"
          variant="outline"
          disabled={saving !== null}
          onClick={() => set(s)}
          className={cn("h-7", current === s && tone[s])}
        >
          {ENQUIRY_STATUS_LABEL[s]}
        </Button>
      ))}
    </div>
  );
}

// ============================================================
// Detail Dialog Component
// ============================================================

function InquiryDetailDialog({ inquiry }: { inquiry: InquiryData }) {
  return (
    <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Inquiry from {inquiry.name}</DialogTitle>
        <DialogDescription>
          Submitted {format(new Date(inquiry.createdAt), "dd MMM yyyy, hh:mm a")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm">
            <MailIcon className="size-4 text-zinc-400" />
            <span>{inquiry.email}</span>
          </div>
          {inquiry.phone && (
            <div className="flex items-center gap-2 text-sm">
              <PhoneIcon className="size-4 text-zinc-400" />
              <span>{inquiry.phone}</span>
            </div>
          )}
          {inquiry.eventType && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="size-4 text-zinc-400" />
              <span>{inquiry.eventType}</span>
            </div>
          )}
          {inquiry.eventDate && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="size-4 text-zinc-400" />
              <span>{format(new Date(inquiry.eventDate), "dd MMM yyyy")}</span>
            </div>
          )}
          {inquiry.guestCount && (
            <div className="flex items-center gap-2 text-sm">
              <UsersIcon className="size-4 text-zinc-400" />
              <span>{inquiry.guestCount} guests</span>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Message</p>
          <p className="whitespace-pre-wrap rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">
            {inquiry.message}
          </p>
        </div>

        {/* Enquiry outcome + follow-up scheduling */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <EnquiryStatusControl inquiry={inquiry} />
          <ScheduleTaskDialog inquiryId={inquiry.id} />
        </div>

        {/* Editable notes + call log */}
        <CrmNotesPanel inquiryId={inquiry.id} />
      </div>
    </DialogContent>
  );
}

// ============================================================
// Actions Cell
// ============================================================

function ActionsCell({ inquiry }: { inquiry: InquiryData }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleProcess = async () => {
    setLoading(true);
    try {
      const result = await processInquiry(inquiry.id);
      if (result.success) {
        toast.success("Inquiry processed — Contact and Lead created");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to process inquiry");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async () => {
    setLoading(true);
    try {
      const result = await markInquiryProcessed(inquiry.id);
      if (result.success) {
        toast.success("Inquiry marked as processed");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to mark inquiry as processed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const result = await deleteInquiry(inquiry.id);
      if (result.success) {
        toast.success("Inquiry deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete inquiry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" disabled={loading}>
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DialogTrigger asChild>
              <DropdownMenuItem>
                <MailIcon className="mr-2 size-4" />
                View Details
              </DropdownMenuItem>
            </DialogTrigger>
            {!inquiry.isProcessed && (
              <>
                <DropdownMenuItem onClick={handleProcess}>
                  <UserPlusIcon className="mr-2 size-4" />
                  Process (Create Contact & Lead)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMarkDone}>
                  <CheckCircleIcon className="mr-2 size-4" />
                  Mark as Done
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <AlertDialogTrigger asChild>
              <DropdownMenuItem className="text-destructive">
                <TrashIcon className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </AlertDialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Detail Dialog */}
        <InquiryDetailDialog inquiry={inquiry} />
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Inquiry</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the inquiry from{" "}
            <span className="font-medium">{inquiry.name}</span>? This action
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

const columns: ColumnDef<InquiryData>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.getValue("name")}</p>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
      </div>
    ),
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
    accessorKey: "guestCount",
    header: "Guests",
    cell: ({ row }) => {
      const count = row.getValue("guestCount") as number | null;
      return count ? count.toLocaleString() : "--";
    },
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => {
      const message = row.getValue("message") as string;
      return (
        <p className="max-w-[200px] truncate text-sm text-muted-foreground">
          {message}
        </p>
      );
    },
  },
  {
    accessorKey: "isProcessed",
    header: "Status",
    cell: ({ row }) => {
      const isProcessed = row.getValue("isProcessed") as boolean;
      return (
        <Badge
          variant="outline"
          className={cn(
            "border font-medium",
            isProcessed
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-yellow-100 text-yellow-800 border-yellow-200"
          )}
        >
          {isProcessed ? "Processed" : "Pending"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Submitted" />
    ),
    cell: ({ row }) =>
      format(new Date(row.getValue("createdAt") as string), "dd MMM yyyy"),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => <ActionsCell inquiry={row.original} />,
  },
];

// ============================================================
// InquiryTable Component
// ============================================================

interface InquiryTableProps {
  data: InquiryData[];
}

export function InquiryTable({ data }: InquiryTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Search by name..."
    />
  );
}
