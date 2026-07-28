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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
  NOTIFIED: "bg-warning/15 text-warning border-warning/25",
  CONFIRMED: "bg-success/12 text-success border-success/25",
  DECLINED: "bg-destructive/12 text-destructive border-destructive/25",
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
      <PageHeader
        eyebrow="Schedule"
        icon={CalendarCheck}
        accent="teal"
        title="Your events"
        description="Every date our clients are counting on you for."
      >
        <Badge variant="outline" className="numeric">
          {data.total} {data.total === 1 ? "event" : "events"}
        </Badge>
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
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
      </PageHeader>

      {/* Operation Assignments — per-operation confirm/decline */}
      {(opLoading || opAssignments.length > 0) && (
        <Card className="rounded-2xl border bg-card shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-teal-700 dark:text-teal-300" />
              <CardTitle className="text-[15px] font-semibold">
                Needs your answer
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Confirm the dates you can cover — the sooner we know, the better we
              plan around you.
            </p>
          </CardHeader>
          <CardContent>
            {opLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading your assignments…
              </p>
            ) : (
              <div className="space-y-3">
                {opAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {a.booking.eventName}
                          </p>
                          <StatusBadge
                            status={a.status}
                            colorMap={OP_ASSIGNMENT_STATUS_COLORS}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="numeric">{a.booking.bookingNumber}</span>
                          {" · "}
                          {a.booking.eventType}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            <span className="numeric">{formatDate(a.booking.date)}</span>
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
                            className="gap-1 bg-success text-success-foreground hover:bg-success/90"
                            disabled={pending && pendingId === a.id}
                            onClick={() => handleConfirm(a)}
                          >
                            <CheckCircle2 className="size-4" />
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
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
      <Card className="rounded-2xl border bg-card shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-[15px] font-semibold">
            Assigned bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.data.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck />}
              title={
                statusFilter !== "all"
                  ? "Nothing under this filter"
                  : "No dates on your calendar with us yet"
              }
              description={
                statusFilter !== "all"
                  ? "Switch back to all statuses to see every event you've been part of."
                  : "Once our team books you onto an event, the date, venue, and your role all appear here."
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="[&>th]:text-[11px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted-foreground">
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time slot</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead className="text-right">Guests</TableHead>
                      <TableHead>Your role</TableHead>
                      <TableHead>Assignment</TableHead>
                      <TableHead>Booking</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((assignment) => (
                      <TableRow
                        key={assignment.id}
                        className={`transition-colors hover:bg-muted/40 ${loading ? "opacity-50" : ""}`}
                      >
                        <TableCell className="py-3.5">
                          <div>
                            <p className="font-medium text-foreground">
                              {assignment.booking.eventName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              <span className="numeric">
                                {assignment.booking.bookingNumber}
                              </span>
                              {" · "}
                              {assignment.booking.eventType}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="numeric whitespace-nowrap py-3.5 text-sm text-muted-foreground">
                          {formatDate(assignment.booking.date)}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground">
                          {TIME_SLOT_LABELS[assignment.booking.timeSlot] || assignment.booking.timeSlot}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground">
                          {assignment.booking.venue.name}
                        </TableCell>
                        <TableCell className="numeric py-3.5 text-right text-sm text-muted-foreground">
                          {assignment.booking.guestCount}
                        </TableCell>
                        <TableCell className="py-3.5 text-sm text-muted-foreground">
                          {assignment.role || "—"}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <StatusBadge
                            status={assignment.status}
                            colorMap={VENDOR_ASSIGNMENT_STATUS_COLORS}
                          />
                        </TableCell>
                        <TableCell className="py-3.5">
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
                    className={`rounded-xl border bg-muted/30 p-4 ${
                      loading ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {assignment.booking.eventName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="numeric">
                            {assignment.booking.bookingNumber}
                          </span>
                          {" · "}
                          {assignment.booking.eventType}
                        </p>
                      </div>
                      <StatusBadge
                        status={assignment.status}
                        colorMap={VENDOR_ASSIGNMENT_STATUS_COLORS}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="size-3" />
                        <span className="numeric">{formatDate(assignment.booking.date)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {assignment.booking.venue.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="size-3" />
                        <span className="numeric">{assignment.booking.guestCount}</span>{" "}
                        guests
                      </div>
                    </div>
                    {assignment.role && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Role: <span className="font-medium text-foreground">{assignment.role}</span>
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
                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Page <span className="numeric">{data.page}</span> of{" "}
                    <span className="numeric">{data.totalPages}</span> ·{" "}
                    <span className="numeric">{data.total}</span> total
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
            <p className="text-sm text-muted-foreground">
              {declineTarget?.booking.eventName} &middot;{" "}
              <span className="numeric">
                {declineTarget ? formatDate(declineTarget.booking.date) : ""}
              </span>
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
              variant="destructive"
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
