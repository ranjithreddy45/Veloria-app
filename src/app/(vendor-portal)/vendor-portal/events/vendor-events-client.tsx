"use client";

import * as React from "react";
import { CalendarCheck, MapPin, Users, Clock, Filter } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { getVendorEvents } from "@/actions/vendor-portal.actions";
import type { VendorAssignmentStatus } from "@prisma/client";

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

interface VendorEventsClientProps {
  initialData: VendorEventsData;
}

// ============================================================
// Vendor Events Client Component
// ============================================================

export function VendorEventsClient({ initialData }: VendorEventsClientProps) {
  const [data, setData] = React.useState(initialData);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(false);

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
    </div>
  );
}
