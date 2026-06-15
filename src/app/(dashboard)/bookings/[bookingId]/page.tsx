import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  PencilIcon,
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  ClockIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  IndianRupeeIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ListChecksIcon,
  PlayCircleIcon,
  LayoutDashboardIcon,
  ClipboardListIcon,
  CalendarClockIcon,
} from "lucide-react";

import { getBooking } from "@/actions/booking.actions";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  BOOKING_STATUS_COLORS,
  TIME_SLOT_LABELS,
  INVOICE_STATUS_COLORS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants";
import { CommunicationTimeline } from "@/components/shared/communication-timeline";
import { BookingActions } from "./_components/booking-actions";
import { BookingOpsLinks } from "./_components/booking-ops-links";
import { formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Booking Details" };

// ============================================================
// Booking Detail Page
// ============================================================

interface BookingDetailPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const { bookingId } = await params;
  const result = await getBooking(bookingId);

  if (!result.success || !result.data) {
    notFound();
  }

  const booking = result.data;

  const holdExpired =
    booking.holdExpiresAt && isPast(new Date(booking.holdExpiresAt));

  // Event-ops handoff: once a booking is confirmed, ops staff can spin up the
  // day-of documents straight from here. Look up any that already exist so we
  // offer "View" instead of creating duplicates.
  const opsReady = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(
    booking.status
  );
  const [existingBeo, existingKitchen] = opsReady
    ? await Promise.all([
        prisma.beo.findFirst({
          where: { bookingId: booking.id },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.kitchenPlan.findFirst({
          where: { bookingId: booking.id },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [null, null];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {booking.eventName}
            </h1>
            <StatusBadge
              status={booking.status}
              colorMap={BOOKING_STATUS_COLORS}
            />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {booking.bookingNumber} | {booking.eventType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/bookings/${booking.id}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
          <BookingActions
            bookingId={booking.id}
            currentStatus={booking.status}
          />
        </div>
      </div>

      {/* Hold Warning */}
      {booking.status === "HOLD" && booking.holdExpiresAt && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            holdExpired
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <ClockIcon
            className={`size-5 ${holdExpired ? "text-red-500" : "text-amber-500"}`}
          />
          <div>
            <p
              className={`text-sm font-medium ${
                holdExpired ? "text-red-800" : "text-amber-800"
              }`}
            >
              {holdExpired ? "Hold has expired" : "Booking is on hold"}
            </p>
            <p
              className={`text-xs ${
                holdExpired ? "text-red-600" : "text-amber-600"
              }`}
            >
              {holdExpired
                ? `Expired ${formatDistanceToNow(new Date(booking.holdExpiresAt), { addSuffix: true })}`
                : `Expires ${formatDistanceToNow(new Date(booking.holdExpiresAt), { addSuffix: true })}`}
            </p>
          </div>
        </div>
      )}

      {/* Quick Access Links */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/bookings/${booking.id}/execution`}>
            <PlayCircleIcon className="mr-1.5 size-4" />
            Execution Plan
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/bookings/${booking.id}/control`}>
            <LayoutDashboardIcon className="mr-1.5 size-4" />
            Live Control
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/bookings/${booking.id}/operations`}>
            <ClipboardListIcon className="mr-1.5 size-4" />
            Operations
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/bookings/${booking.id}/day-of`}>
            <CalendarClockIcon className="mr-1.5 size-4" />
            Day Of Timeline
          </Link>
        </Button>
        {opsReady && (
          <BookingOpsLinks
            bookingId={booking.id}
            covers={booking.guestCount}
            beoId={existingBeo?.id ?? null}
            kitchenPlanId={existingKitchen?.id ?? null}
          />
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({booking.invoices.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks ({booking.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="communications">
            Communications
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Event Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Date</p>
                    <p className="text-sm font-medium">
                      {format(new Date(booking.date), "EEEE, dd MMMM yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ClockIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Time Slot</p>
                    <p className="text-sm font-medium">
                      {TIME_SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <UsersIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Guest Count</p>
                    <p className="text-sm font-medium">{booking.guestCount} guests</p>
                  </div>
                </div>
                {(booking.startTime || booking.endTime) && (
                  <div className="flex items-center gap-3">
                    <ClockIcon className="text-muted-foreground size-4 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Event Window</p>
                      <p className="text-sm font-medium">
                        {booking.startTime
                          ? format(new Date(booking.startTime), "dd MMM, h:mm a")
                          : "—"}
                        {" – "}
                        {booking.endTime
                          ? format(new Date(booking.endTime), "h:mm a")
                          : "—"}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <IndianRupeeIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Total Amount</p>
                    <p className="text-sm font-medium">
                      {formatINR(booking.totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Commercials breakdown (mirrors Zoho Bookings) */}
                {(booking.perPlatePrice != null ||
                  booking.hallRental != null ||
                  booking.decorCharges != null ||
                  booking.otherServices != null) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs mb-2">
                        Commercials
                      </p>
                      <dl className="space-y-1.5 text-sm">
                        {booking.perPlatePrice != null && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              Per Plate Price
                            </dt>
                            <dd className="font-medium tabular-nums">
                              {formatINR(booking.perPlatePrice)}
                            </dd>
                          </div>
                        )}
                        {booking.hallRental != null && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">Hall Rental</dt>
                            <dd className="font-medium tabular-nums">
                              {formatINR(booking.hallRental)}
                            </dd>
                          </div>
                        )}
                        {booking.decorCharges != null && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              Decor Charges
                            </dt>
                            <dd className="font-medium tabular-nums">
                              {formatINR(booking.decorCharges)}
                            </dd>
                          </div>
                        )}
                        {booking.otherServices != null && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">
                              Other Services
                            </dt>
                            <dd className="font-medium tabular-nums">
                              {formatINR(booking.otherServices)}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </>
                )}
                {booking.specialRequests && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">
                        Special Requests
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {booking.specialRequests}
                      </p>
                    </div>
                  </>
                )}
                {booking.internalNotes && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Internal Notes
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-zinc-600">
                      {booking.internalNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Venue Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Venue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <MapPinIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Venue Name</p>
                    <p className="text-sm font-medium">{booking.venue.name}</p>
                  </div>
                </div>
                {booking.hallBooked && (
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="text-muted-foreground size-4 shrink-0 opacity-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Hall Booked</p>
                      <p className="text-sm font-medium">{booking.hallBooked}</p>
                    </div>
                  </div>
                )}
                {booking.venue.description && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Description
                    </p>
                    <p className="text-sm text-zinc-600">
                      {booking.venue.description}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Capacity</p>
                  <p className="text-sm">{booking.venue.capacity} guests</p>
                </div>
                {booking.venue.amenities.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-2">Amenities</p>
                    <div className="flex flex-wrap gap-1">
                      {booking.venue.amenities.map((amenity: string) => (
                        <Badge key={amenity} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.venue.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  View on Google Maps
                </a>
              </CardContent>
            </Card>

            {/* Client Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Client</span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/contacts/${booking.contact.id}`}>
                      View Contact
                      <ExternalLinkIcon className="ml-1.5 size-3" />
                    </Link>
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <UserIcon className="text-muted-foreground size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="text-sm font-medium">
                      {booking.contact.firstName} {booking.contact.lastName}
                    </p>
                  </div>
                </div>
                {booking.contact.email && (
                  <div className="flex items-center gap-3">
                    <MailIcon className="text-muted-foreground size-4 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Email</p>
                      <p className="text-sm">{booking.contact.email}</p>
                    </div>
                  </div>
                )}
                {booking.contact.phone && (
                  <div className="flex items-center gap-3">
                    <PhoneIcon className="text-muted-foreground size-4 shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-xs">Phone</p>
                      <p className="text-sm">{booking.contact.phone}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Booking Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-muted-foreground text-xs">Booking Number</p>
                  <p className="text-sm font-mono font-medium">
                    {booking.bookingNumber}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created By</p>
                  <p className="text-sm">{booking.createdBy.name || booking.createdBy.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Created At</p>
                  <p className="text-sm">
                    {format(new Date(booking.createdAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Last Updated</p>
                  <p className="text-sm">
                    {format(new Date(booking.updatedAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                <span className="flex items-center gap-2">
                  <FileTextIcon className="size-4" />
                  Invoices
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {booking.invoices.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No invoices created for this booking yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {booking.invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <div className="text-muted-foreground mt-1 text-xs">
                            Issued:{" "}
                            {format(new Date(invoice.issueDate), "dd MMM yyyy")}{" "}
                            | Due:{" "}
                            {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {formatINR(invoice.totalAmount)}
                            </p>
                            {Number(invoice.balanceDue) > 0 && (
                              <p className="text-destructive text-xs">
                                Due: {formatINR(invoice.balanceDue)}
                              </p>
                            )}
                          </div>
                          <StatusBadge
                            status={invoice.status}
                            colorMap={INVOICE_STATUS_COLORS}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                <span className="flex items-center gap-2">
                  <ListChecksIcon className="size-4" />
                  Tasks
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {booking.tasks.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No tasks associated with this booking yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {booking.tasks.map(
                    (task: {
                      id: string;
                      title: string;
                      status: string;
                      priority: string;
                      dueDate: Date | string | null;
                      assignee: { id: string; name: string | null } | null;
                    }) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{task.title}</p>
                          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                            {task.dueDate && (
                              <span>
                                Due:{" "}
                                {format(new Date(task.dueDate), "dd MMM yyyy")}
                              </span>
                            )}
                            {task.assignee && (
                              <span>Assigned to: {task.assignee.name}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge
                            status={task.priority}
                            colorMap={TASK_PRIORITY_COLORS}
                          />
                          <StatusBadge
                            status={task.status}
                            colorMap={{
                              TODO: "bg-slate-100 text-slate-800 border-slate-200",
                              IN_PROGRESS:
                                "bg-blue-100 text-blue-800 border-blue-200",
                              IN_REVIEW:
                                "bg-amber-100 text-amber-800 border-amber-200",
                              DONE: "bg-green-100 text-green-800 border-green-200",
                            }}
                          />
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Communications Tab */}
        <TabsContent value="communications" className="mt-6">
          <CommunicationTimeline
            contactId={booking.contact.id}
            bookingId={booking.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
