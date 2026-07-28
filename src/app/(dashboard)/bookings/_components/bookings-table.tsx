"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { type ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontalIcon,
  EyeIcon,
  PencilIcon,
  XCircleIcon,
  DownloadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumnHeader } from "@/components/shared/data-table";
import {
  FacetFilterRail,
  type FacetDef,
} from "@/components/shared/facet-filter-rail";
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
  BOOKING_STATUS_COLORS,
  TIME_SLOT_LABELS,
} from "@/lib/constants";
import { cancelBooking } from "@/actions/booking.actions";
import { exportBookings } from "@/actions/export.actions";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import { formatINR } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

export interface BookingRow {
  id: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  status: string;
  isExpiredHold?: boolean;
  date: Date | string;
  timeSlot: string;
  guestCount: number;
  totalAmount: unknown;
  venue: { id: string; name: string };
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
}

interface BookingsTableProps {
  data: BookingRow[];
}

// ============================================================
// BookingsTable Component
// ============================================================

// Pretty-print SCREAMING_SNAKE enum values (e.g. WEDDING_RECEPTION → Wedding
// Reception, ON_HOLD → On Hold).
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Stable YYYY-MM key + human label for the Month facet, ordered most-recent
// first via the leading sort key embedded in the value.
function monthKey(date: Date | string): string | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

export function BookingsTable({ data }: BookingsTableProps) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [filtered, setFiltered] = React.useState<BookingRow[]>(data);

  // Keep the filtered view in sync when the parent supplies new rows.
  React.useEffect(() => {
    setFiltered(data);
  }, [data]);

  const facets = React.useMemo<FacetDef<BookingRow>[]>(
    () => [
      { key: "status", label: "Status", get: (b) => b.status, format: titleCase },
      { key: "venue", label: "Venue", get: (b) => b.venue?.name },
      {
        key: "eventType",
        label: "Event type",
        get: (b) => b.eventType,
        format: titleCase,
      },
      {
        key: "month",
        label: "Month",
        get: (b) => monthKey(b.date),
        format: monthLabel,
      },
    ],
    [],
  );

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    try {
      const result = await cancelBooking(bookingId, "Cancelled from bookings list");
      if (result.success) {
        toast.success("Booking cancelled successfully");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  }

  const columns: ColumnDef<BookingRow, unknown>[] = [
    {
      accessorKey: "bookingNumber",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Booking #" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/bookings/${row.original.id}`}
          className="numeric text-[13px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {row.original.bookingNumber}
        </Link>
      ),
    },
    {
      accessorKey: "eventName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Event Name" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[220px] truncate text-[13.5px] font-medium tracking-[-0.01em]">
          {row.original.eventName}
        </div>
      ),
    },
    {
      accessorKey: "eventType",
      header: "Event Type",
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">
          {titleCase(row.original.eventType)}
        </span>
      ),
    },
    {
      accessorKey: "venue",
      header: "Venue",
      cell: ({ row }) => (
        <span className="text-[13px]">{row.original.venue.name}</span>
      ),
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => (
        <span className="numeric text-[13px]">
          {format(new Date(row.original.date), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "timeSlot",
      header: "Time Slot",
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">
          {TIME_SLOT_LABELS[row.original.timeSlot]
            ?.split("(")[0]
            ?.trim() || row.original.timeSlot}
        </span>
      ),
    },
    {
      accessorKey: "guestCount",
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="Guests" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="numeric text-right text-[13px]">
          {row.original.guestCount}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.isExpiredHold ? (
          // Past-dated hold: surface a derived "expired" badge (data unchanged).
          <StatusBadge
            status={row.original.status}
            colorMap={BOOKING_STATUS_COLORS}
            label="Hold — expired"
            className="border-red-200 bg-red-50 text-red-700"
          />
        ) : (
          <StatusBadge
            status={row.original.status}
            colorMap={BOOKING_STATUS_COLORS}
          />
        ),
    },
    {
      accessorKey: "totalAmount",
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="Amount" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="numeric text-right text-[13px] font-semibold">
          {formatINR(row.original.totalAmount)}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const booking = row.original;
        const isCancelling = cancellingId === booking.id;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" disabled={isCancelling}>
                <MoreHorizontalIcon className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/bookings/${booking.id}`}>
                  <EyeIcon className="mr-2 size-4" />
                  View
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/bookings/${booking.id}/edit`}>
                  <PencilIcon className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {booking.status !== "CANCELLED" && booking.status !== "COMPLETED" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleCancel(booking.id)}
                    disabled={isCancelling}
                  >
                    <XCircleIcon className="mr-2 size-4" />
                    Cancel
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  function ExportButton() {
    const [loading, setLoading] = React.useState(false);

    async function handleExport() {
      setLoading(true);
      try {
        const result = await exportBookings();
        if (result.success) {
          const csv = toCSV(result.data.headers, result.data.rows);
          downloadCSV(`bookings-${new Date().toISOString().split("T")[0]}.csv`, csv);
          toast.success("Bookings exported successfully");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Failed to export bookings");
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

  return (
    <div className="flex items-start gap-4">
      <FacetFilterRail
        items={data}
        facets={facets}
        onChange={setFiltered}
        className="hidden lg:block"
      />
      <div className="min-w-0 flex-1">
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="bookingNumber"
          searchPlaceholder="Search by booking number..."
          toolbarExtra={<ExportButton />}
        />
      </div>
    </div>
  );
}
