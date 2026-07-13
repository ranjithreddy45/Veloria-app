import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookingTerms } from "@/components/legal/booking-terms";
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
import { auth } from "@/../auth";
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
import { BookingReadinessCard } from "./_components/booking-readiness-card";
import { ServiceConfirmationCard } from "./_components/service-confirmation-card";
import { getBookingServices } from "@/actions/booking-services.actions";
import { EventPipelineTracker, type PipelineStage } from "./_components/event-pipeline-tracker";
import { SignaturePanel } from "./_components/signature-panel";
import { VendorWorkOrdersCard } from "./_components/vendor-work-orders-card";
import { getWorkOrders } from "@/actions/work-order.actions";
import { getVendors } from "@/actions/vendor.actions";
import { getHandoverMeeting } from "@/actions/handover.actions";
import { HandoverCard, type HandoverMeeting } from "./_components/handover-card";
import { BookingPhotos } from "./_components/booking-photos";
import { GuestFeedbackCard } from "./_components/guest-feedback-card";
import { getGalleryItems } from "@/actions/gallery.actions";
import { hasPermission } from "@/lib/permissions";
import { formatINR, cn } from "@/lib/utils";

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
  const [result, session] = await Promise.all([getBooking(bookingId), auth()]);
  const isSuperAdmin =
    (session?.user as { role?: string } | undefined)?.role === "SUPER_ADMIN";

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
  const [existingBeo, existingKitchen, existingContract] = opsReady
    ? await Promise.all([
        prisma.beo.findFirst({
          where: { bookingId: booking.id },
          select: { id: true, status: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.kitchenPlan.findFirst({
          where: { bookingId: booking.id },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.contract.findFirst({
          where: { bookingId: booking.id },
          select: { id: true },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [null, null, null];

  // CR-002: derive the 6-stage event lifecycle from existing data (no new
  // source of truth). Stages 4–6 light up as CR-006/007 modules ship.
  const operation = await prisma.eventOperation.findUnique({
    where: { bookingId: booking.id },
    select: { status: true, vendorAssignments: { select: { status: true } } },
  });

  // CR-004: Service confirmation (Stage 2) — selections + 24h SLA.
  const servicesResult = await getBookingServices(booking.id);
  const servicesData = servicesResult.success ? servicesResult.data : null;

  // CR-005: Vendor work orders (Stage 3) + active-vendor list for the picker.
  // Also: event/readiness photos + any existing guest-feedback review.
  const [workOrdersResult, vendorsResult, handoverMeeting, galleryResult, existingReview] =
    await Promise.all([
      getWorkOrders(booking.id),
      getVendors({ status: "ACTIVE", limit: 200 }),
      getHandoverMeeting(booking.id),
      getGalleryItems({ bookingId: booking.id, limit: 200 }),
      prisma.review.findFirst({
        where: { bookingId: booking.id },
        select: { id: true, rating: true, title: true, content: true },
      }),
    ]);
  const galleryItems = galleryResult.success ? galleryResult.data.data : [];
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  const canUploadPhotos = hasPermission(role, "gallery:create");
  const canModerate = hasPermission(role, "reviews:moderate");
  const workOrders = workOrdersResult.success ? workOrdersResult.data : [];
  const vendorOptions = vendorsResult.success
    ? vendorsResult.data.data.map((v) => ({ id: v.id, name: v.name }))
    : [];
  const isConfirmed = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(booking.status);
  const beoStatus = existingBeo?.status ?? null;
  const va = operation?.vendorAssignments ?? [];
  const vendorsConfirmed = va.length > 0 && va.every((v) => v.status === "CONFIRMED");
  const pipelineStages: PipelineStage[] = [
    {
      name: "Booking confirmed",
      status: isConfirmed ? "COMPLETED" : ["HOLD", "TENTATIVE"].includes(booking.status) ? "IN_PROGRESS" : "PENDING",
      who: "Sales",
      detail: "Payment / contract confirmed and the slot is locked.",
    },
    {
      name: "Services confirmed",
      status: beoStatus === "LOCKED" ? "COMPLETED" : beoStatus === "PUBLISHED" ? "IN_PROGRESS" : "PENDING",
      who: "Event coordinator",
      detail: "Menu, décor and all services finalised on the function sheet (BEO).",
    },
    {
      name: "Vendor notification",
      status: vendorsConfirmed ? "COMPLETED" : va.length > 0 ? "IN_PROGRESS" : "PENDING",
      who: "Operations",
      detail: va.length
        ? `${va.filter((v) => v.status === "CONFIRMED").length}/${va.length} vendors confirmed.`
        : "Vendors not yet assigned / notified.",
    },
    { name: "Property readiness", status: "PENDING", who: "Property manager", detail: "T-2 day property checklist (rolling out)." },
    { name: "Vendor readiness", status: "PENDING", who: "Operations", detail: "Day-before vendor confirmation (rolling out)." },
    { name: "Guest event readiness", status: "PENDING", who: "Event coordinator", detail: "Guest pre-event brief sent (rolling out)." },
  ];

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
            canOverride={isSuperAdmin}
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

      {/* CR-002: 6-stage event lifecycle pipeline + health % */}
      <EventPipelineTracker stages={pipelineStages} />

      {/* CR-003: Stage 1 payment summary (Total invoiced / Collected / Pending) */}
      {booking.invoices.length > 0 &&
        (() => {
          const totalInvoiced = booking.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
          const pending = booking.invoices.reduce((s, i) => s + Number(i.balanceDue), 0);
          const collected = Math.max(0, totalInvoiced - pending);
          const pct = totalInvoiced > 0 ? Math.round((collected / totalInvoiced) * 100) : 0;
          const dueDates = booking.invoices
            .filter((i) => Number(i.balanceDue) > 0 && i.dueDate)
            .map((i) => new Date(i.dueDate as unknown as string).getTime())
            .sort((a, b) => a - b);
          const nextDue = dueDates.length ? new Date(dueDates[0]) : null;
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <IndianRupeeIcon className="size-4 text-emerald-600" /> Payment summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total invoiced</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatINR(totalInvoiced)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collected</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-600">{formatINR(collected)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending</p>
                    <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", pending > 0 ? "text-amber-600" : "text-muted-foreground")}>{formatINR(pending)}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                    <span className="tabular-nums">{pct}% collected</span>
                    {nextDue && pending > 0 && <span>Next due {format(nextDue, "d MMM yyyy")}</span>}
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pending <= 0
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-violet-500 to-emerald-500"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {/* Goal-gradient framing: show the small remaining gap */}
                  {pending <= 0 ? (
                    <p className="mt-1.5 text-[12px] font-medium text-emerald-600">Fully paid 🎉</p>
                  ) : pct >= 80 ? (
                    <p className="mt-1.5 text-[12px] font-medium text-amber-600">
                      Almost there —{" "}
                      <span className="tabular-nums text-emerald-700">
                        {"₹" + Math.round(pending).toLocaleString("en-IN")}
                      </span>{" "}
                      to go
                    </p>
                  ) : (
                    <p className="mt-1.5 text-[12px] text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">
                        {"₹" + Math.round(pending).toLocaleString("en-IN")}
                      </span>{" "}
                      away from fully paid
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

      {/* Readiness checklist (poka-yoke) — informational, never blocking */}
      <BookingReadinessCard
        beoStatus={existingBeo?.status ?? null}
        hasInvoices={booking.invoices.length > 0}
        hasBalanceDue={booking.invoices.some(
          (inv) => Number(inv.balanceDue) > 0
        )}
        guestCount={booking.guestCount}
        eventDate={booking.date}
      />

      {/* CR-004: Service confirmation (Stage 2) — décor, photo/video, add-ons + 24h SLA */}
      {servicesData && (
        <ServiceConfirmationCard bookingId={booking.id} data={servicesData} />
      )}

      {/* CR-005: Vendor notification & work orders (Stage 3) */}
      <VendorWorkOrdersCard
        bookingId={booking.id}
        workOrders={workOrders}
        vendors={vendorOptions}
      />

      {/* Sales → Ops handover meeting (24h SLA) + guest confirmation (48h TAT) */}
      <HandoverCard
        bookingId={booking.id}
        handover={(handoverMeeting as HandoverMeeting | null) ?? null}
        guestConfirmationDueAt={
          booking.guestConfirmationDueAt
            ? new Date(booking.guestConfirmationDueAt).toISOString()
            : null
        }
        guestConfirmedAt={
          booking.guestConfirmedAt
            ? new Date(booking.guestConfirmedAt).toISOString()
            : null
        }
      />

      {/* Event / readiness photos (pre / post / during) */}
      <BookingPhotos
        bookingId={booking.id}
        items={galleryItems}
        canUploadPhotos={canUploadPhotos}
      />

      {/* Staff-entered guest feedback + rating */}
      <GuestFeedbackCard
        bookingId={booking.id}
        review={existingReview}
        canModerate={canModerate}
      />

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
            contractId={existingContract?.id ?? null}
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

          <SignaturePanel
            bookingId={booking.id}
            canRequest={
              booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS"
            }
          />
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
              <Button size="sm" asChild>
                <Link href={`/invoices/new?bookingId=${booking.id}`}>
                  <FileTextIcon className="mr-2 size-4" />
                  Generate Proforma Invoice
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {booking.invoices.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center text-sm">
                  <p>No invoices created for this booking yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <Link href={`/invoices/new?bookingId=${booking.id}`}>
                      <FileTextIcon className="mr-2 size-4" />
                      Generate Proforma Invoice
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {booking.invoices.map((invoice) => (
                      <Link
                        key={invoice.id}
                        href={`/invoices/${invoice.id}`}
                        className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors"
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
                      </Link>
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

      {/* Terms & Conditions — same canonical terms shown on the confirmation */}
      <BookingTerms className="mt-6" />
    </div>
  );
}
