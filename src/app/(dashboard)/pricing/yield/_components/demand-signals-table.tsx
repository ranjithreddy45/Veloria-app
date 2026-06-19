"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
} from "lucide-react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableColumnHeader,
} from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  upsertVenueDemandSignal,
  deleteVenueDemandSignal,
} from "@/actions/yield-pricing.actions";
import { BOOKABLE_SLOTS, SLOT_LABEL } from "@/lib/sales/slot";
import type { TimeSlotEnum } from "@/lib/sales/slot";

// ============================================================
// Types
// ============================================================

interface DemandSignalRow {
  id: string;
  date: string;
  timeSlot: string | null;
  occupancyPct: number;
  demandScore: number;
  inquiryCount: number;
  manualMultiplier: number | null;
  source: string;
  venue: { id: string; name: string };
}

interface VenueOption {
  id: string;
  name: string;
}

interface DemandSignalsTableProps {
  data: DemandSignalRow[];
  venues: VenueOption[];
}

const NULL_SLOT = "__whole_day__";

// ============================================================
// Upsert Dialog
// ============================================================

function SignalDialog({
  venues,
  existing,
  trigger,
}: {
  venues: VenueOption[];
  existing?: DemandSignalRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const [venueId, setVenueId] = React.useState(
    existing?.venue.id ?? venues[0]?.id ?? ""
  );
  const [date, setDate] = React.useState(
    existing?.date ? existing.date.slice(0, 10) : ""
  );
  const [timeSlot, setTimeSlot] = React.useState<string>(
    existing?.timeSlot ?? NULL_SLOT
  );
  const [occupancyPct, setOccupancyPct] = React.useState(
    existing ? String(existing.occupancyPct) : "0"
  );
  const [demandScore, setDemandScore] = React.useState(
    existing ? String(existing.demandScore) : "0"
  );
  const [inquiryCount, setInquiryCount] = React.useState(
    existing ? String(existing.inquiryCount) : "0"
  );
  const [manualMultiplier, setManualMultiplier] = React.useState(
    existing?.manualMultiplier != null ? String(existing.manualMultiplier) : ""
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId) {
      toast.error("Venue is required");
      return;
    }
    if (!date) {
      toast.error("Date is required");
      return;
    }
    setIsPending(true);
    try {
      const result = await upsertVenueDemandSignal({
        venueId,
        date: new Date(date + "T00:00:00.000Z"),
        timeSlot:
          timeSlot === NULL_SLOT ? null : (timeSlot as TimeSlotEnum),
        occupancyPct: Number(occupancyPct) || 0,
        demandScore: Number(demandScore) || 0,
        inquiryCount: Number(inquiryCount) || 0,
        manualMultiplier:
          manualMultiplier.trim() === "" ? null : Number(manualMultiplier),
      });
      if (result.success) {
        toast.success("Demand signal saved");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to save demand signal");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit Demand Signal" : "Add Demand Signal"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Venue</Label>
            <Select
              value={venueId}
              onValueChange={setVenueId}
              disabled={!!existing}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!!existing}
              />
            </div>
            <div className="space-y-2">
              <Label>Slot</Label>
              <Select
                value={timeSlot}
                onValueChange={setTimeSlot}
                disabled={!!existing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Slot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NULL_SLOT}>Whole day (any slot)</SelectItem>
                  {BOOKABLE_SLOTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="occ">Occupancy %</Label>
              <Input
                id="occ"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={occupancyPct}
                onChange={(e) => setOccupancyPct(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dem">Demand Score</Label>
              <Input
                id="dem"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={demandScore}
                onChange={(e) => setDemandScore(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inq">Inquiry Count</Label>
              <Input
                id="inq"
                type="number"
                min="0"
                step="1"
                value={inquiryCount}
                onChange={(e) => setInquiryCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mult">Manual Multiplier</Label>
              <Input
                id="mult"
                type="number"
                min="0.01"
                max="10"
                step="0.001"
                placeholder="(none)"
                value={manualMultiplier}
                onChange={(e) => setManualMultiplier(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Saving creates a MANUAL row — the daily refresh cron will not
            overwrite it. Use the manual multiplier to force an event-week surge.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DemandSignalsTable
// ============================================================

export function DemandSignalsTable({ data, venues }: DemandSignalsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const result = await deleteVenueDemandSignal(id);
      if (result.success) {
        toast.success("Demand signal deleted");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete demand signal");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: ColumnDef<DemandSignalRow, unknown>[] = [
    {
      accessorKey: "venue",
      header: "Venue",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {row.original.venue?.name ?? "--"}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {format(new Date(row.original.date), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "timeSlot",
      header: "Slot",
      cell: ({ row }) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {row.original.timeSlot
            ? SLOT_LABEL[row.original.timeSlot as TimeSlotEnum]
            : "Whole day"}
        </span>
      ),
    },
    {
      accessorKey: "occupancyPct",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Occupancy" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.occupancyPct}%</span>
      ),
    },
    {
      accessorKey: "demandScore",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Demand" />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.demandScore}</span>
      ),
    },
    {
      accessorKey: "inquiryCount",
      header: "Inquiries",
      cell: ({ row }) => (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {row.original.inquiryCount}
        </span>
      ),
    },
    {
      accessorKey: "manualMultiplier",
      header: "Manual ×",
      cell: ({ row }) =>
        row.original.manualMultiplier != null ? (
          <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {row.original.manualMultiplier}x
          </span>
        ) : (
          <span className="text-sm text-zinc-400">--</span>
        ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.original.source === "MANUAL"
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          {row.original.source}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const signal = row.original;
        const isDeleting = deletingId === signal.id;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" disabled={isDeleting}>
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <SignalDialog
                venues={venues}
                existing={signal}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <PencilIcon className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => handleDelete(signal.id)}
                disabled={isDeleting}
              >
                <Trash2Icon className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SignalDialog
          venues={venues}
          trigger={
            <Button size="sm">
              <PlusIcon className="mr-2 size-4" />
              Add Manual Signal
            </Button>
          }
        />
      </div>
      <DataTable columns={columns} data={data} />
    </div>
  );
}
