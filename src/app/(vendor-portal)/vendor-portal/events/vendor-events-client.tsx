"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  MapPin,
  Users,
  Clock,
  Filter,
  CheckCircle2,
  XCircle,
  ClipboardList,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  BOOKING_STATUS_COLORS,
  VENDOR_ASSIGNMENT_STATUS_COLORS,
  TIME_SLOT_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  getVendorEvents,
  getMyOperationAssignments,
  respondToMyAssignment,
} from "@/actions/vendor-portal.actions";
import type { VendorAssignmentStatus } from "@prisma/client";

// Operation-assignment status has no shared colorMap (NOTIFIED|CONFIRMED|DECLINED).
const OP_ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
  NOTIFIED: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  CONFIRMED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  DECLINED: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
};

// ============================================================
// Types
// ============================================================

interface Assignment {
  id: string;
  role: string | null;
  agreedRate: number | null;
  status: string;
  notes: string | null;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    eventType: string;
    date: string;
    timeSlot: string;
    guestCount: number;
    status: string;
    venue: { id: string; name: string };
  };
}

interface VendorEventsData {
  data: Assignment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OpAssignment {
  id: string;
  status: string;
  actionable: boolean;
  role: string | null;
  arrivalTime: string | null;
  setupTime: string | null;
  teardownTime: string | null;
  notes: string | null;
  operationStatus: string;
  booking: {
    id: string;
    bookingNumber: string;
    eventName: string;
    eventType: string;
    date: string;
    timeSlot: string;
    venue: { id: string; name: string } | null;
  };
}

interface VendorEventsClientProps {
  initialData: VendorEventsData;
}

// ============================================================
// Vendor Events Client Component
// ============================================================

export function VendorEventsClient({ initialData }: VendorEventsClientProps) {
  const router = useRouter();
  const [data, setData] = React.useState(initialData);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(false);

  // Operation assignments (per-operation confirm/decline) — fetched client-side.
  const [opAssignments, setOpAssignments] = React.useState<OpAssignment[]>([]);
  const [opLoading, setOpLoading] = React.useState(true);
  const [pending, startTransition] = React.useTransition();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  // Decline dialog state.
  const [declineTarget, setDeclineTarget] = React.useState<OpAssignment | null>(null);
  const [declineReason, setDeclineReason] = React.useState("");

  const fetchOpAssignments = React.useCallback(async () => {
    setOpLoading(true);
    try {
      const result = await getMyOperationAssignments();
      if (result.success) {
        setOpAssignments(result.data as OpAssignment[]);
      }
    } finally {
      setOpLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchOpAssignments();
  }, [fetchOpAssignments]);

  const respond = React.useCallback(
    (assignment: OpAssignment, action: "CONFIRM" | "DECLINE", note?: string) => {
      setPendingId(assignment.id);
      startTransition(async () => {
        try {
          const result = await respondToMyAssignment(assignment.id, action, note);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(
            action === "CONFIRM"
              ? "Assignment confirmed"
              : "Assignment declined"
          );
          await fetchOpAssignments();
          router.refresh();
        } finally {
          setPendingId(null);
        }
      });
    },
    [fetchOpAssignments, router]
  );

  const handleConfirm = (assignment: OpAssignment) => respond(assignment, "CONFIRM");

  const openDecline = (assignment: OpAssignment) => {
    setDeclineReason("");
    setDeclineTarget(assignment);
  };

  const submitDecline = () => {
    if (!declineTarget) return;
    const target = declineTarget;
    setDeclineTarget(null);
    respond(target, "DECLINE", declineReason.trim() || undefined);
  };

  const fetchEvents = React.useCallback(
    async (status?: string, page = 1) => {
      setLoading(true);
      try {
        const result = await getVendorEvents({
          status: status && status !== "all" ? (status as VendorAssignmentStatus) : undefined,
          page,
          limit: 20,
        });
        if (result.success) {
          setData(result.data);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchEvents(value, 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarCheck className="size-6 text-violet-600 dark:text-violet-400" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              My Events
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {data.total} event{data.total !== 1 ? "s" : ""} assigned to you
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-zinc-400" />
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Operation Assignments — per-operation confirm/decline */}
      {(opLoading || opAssignments.length > 0) && (
        <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-violet-600 dark:text-violet-400" />
              <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Operation Assignments
              </CardTitle>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Confirm or decline the operations you have been requested for.
            </p>
          </CardHeader>
          <CardContent>
            {opLoading ? (
              <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                Loading assignments...
              </p>
            ) : (
              <div className="space-y-3">
                {opAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {a.booking.eventName}
                          </p>
                          <StatusBadge
                            status={a.status}
                            colorMap={OP_ASSIGNMENT_STATUS_COLORS}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {a.booking.bookingNumber} &middot; {a.booking.eventType}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDate(a.booking.date)}
                          </span>
                          {a.booking.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" />
                              {a.booking.venue.name}
                            </span>
                          )}
                          {a.role && (
                            <span>
                              Role: <span className="font-medium">{a.role}</span>
                            </span>
                          )}
                          {a.arrivalTime && <span>Arrival: {a.arrivalTime}</span>}
                        </div>
                      </div>

                      {a.actionable ? (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={pending && pendingId === a.id}
                            onClick={() => handleConfirm(a)}
                          >
                            <CheckCircle2 className="size-4" />
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                            disabled={pending && pendingId === a.id}
                            onClick={() => openDecline(a)}
                          >
                            <XCircle className="size-4" />
                            Decline
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Events Table */}
      <Card className="border-zinc-200/80 shadow-sm dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Assigned Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarCheck className="size-12 text-zinc-300 dark:text-zinc-600" />
              <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                No events found
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {statusFilter !== "all"
                  ? "Try changing the filter to see more events."
                  : "You have not been assigned to any bookings yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time Slot</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Guests</TableHead>
                      <TableHead>Your Role</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Booking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((assignment) => (
                      <TableRow key={assignment.id} className={loading ? "opacity-50" : ""}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                              {assignment.booking.eventName}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {assignment.booking.bookingNumber} &middot; {assignment.booking.eventType}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-zinc-600 dark:text-zinc-300">
                          {formatDate(assignment.booking.date)}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                          {TIME_SLOT_LABELS[assignment.booking.timeSlot] || assignment.booking.timeSlot}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                          {assignment.booking.venue.name}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                          {assignment.booking.guestCount}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600 dark:text-zinc-300">
                          {assignment.role || "--"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={assignment.status}
                            colorMap={VENDOR_ASSIGNMENT_STATUS_COLORS}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={assignment.booking.status}
                            colorMap={BOOKING_STATUS_COLORS}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {data.data.map((assignment) => (
                  <div
                    key={assignment.id}
                    className={`rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 ${
                      loading ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {assignment.booking.eventName}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {assignment.booking.bookingNumber} &middot; {assignment.booking.eventType}
                        </p>
                      </div>
                      <StatusBadge
                        status={assignment.status}
                        colorMap={VENDOR_ASSIGNMENT_STATUS_COLORS}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(assignment.booking.date)}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {assignment.booking.venue.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="size-3" />
                        {assignment.booking.guestCount} guests
                      </div>
                    </div>
                    {assignment.role && (
                      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                        Role: <span className="font-medium">{assignment.role}</span>
                      </p>
                    )}
                    <div className="mt-2">
                      <StatusBadge
                        status={assignment.booking.status}
                        colorMap={BOOKING_STATUS_COLORS}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Page {data.page} of {data.totalPages} ({data.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page <= 1 || loading}
                      onClick={() => fetchEvents(statusFilter, data.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page >= data.totalPages || loading}
                      onClick={() => fetchEvents(statusFilter, data.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Decline reason dialog */}
      <Dialog
        open={declineTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeclineTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {declineTarget?.booking.eventName} &middot;{" "}
              {declineTarget ? formatDate(declineTarget.booking.date) : ""}
            </p>
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea
              id="decline-reason"
              rows={3}
              placeholder="Let the team know why you can't take this on..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={pending}
              onClick={submitDecline}
            >
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
