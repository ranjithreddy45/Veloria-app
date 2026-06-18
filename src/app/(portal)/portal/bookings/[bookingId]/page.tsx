import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { BookingTerms } from "@/components/legal/booking-terms";
import {
  ArrowLeft,
  CalendarCheck,
  Clock,
  MapPin,
  Users,
  Phone,
  Mail,
  FileText,
  IndianRupee,
  CheckCircle2,
  Circle,
  Timer,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/../auth";
import { getPortalBooking, getPortalEventProgress } from "@/actions/portal.actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { EventProgressCard } from "./_components/event-progress-card";
import { PhaseProgressList } from "./_components/phase-progress-list";
import { VendorReadinessCard } from "./_components/vendor-readiness-card";
import {
  BOOKING_STATUS_COLORS,
  INVOICE_STATUS_COLORS,
  TIME_SLOT_LABELS,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";

// ============================================================
// Helpers
// ============================================================

function daysUntil(date: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Booking progress steps
const PROGRESS_STEPS = [
  { key: "HOLD", label: "Booked" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
] as const;

function getProgressIndex(status: string): number {
  if (status === "HOLD" || status === "TENTATIVE") return 0;
  if (status === "CONFIRMED") return 1;
  if (status === "IN_PROGRESS") return 2;
  if (status === "COMPLETED") return 3;
  return -1; // CANCELLED
}

// ============================================================
// Booking Detail Page
// ============================================================

export default async function PortalBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const { bookingId } = await params;
  const [booking, eventProgress] = await Promise.all([
    getPortalBooking(session.user.id, bookingId),
    getPortalEventProgress(session.user.id as string, bookingId),
  ]);

  if (!booking) notFound();

  const eventDate = new Date(booking.date);
  const days = daysUntil(eventDate);
  const progressIndex = getProgressIndex(booking.status);
  const isCancelled = booking.status === "CANCELLED";

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/portal/bookings"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
      >
        <ArrowLeft className="size-4" />
        Back to Bookings
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {booking.eventName}
            </h1>
            <StatusBadge
              status={booking.status}
              colorMap={BOOKING_STATUS_COLORS}
            />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {booking.eventType} &middot; Booking #{booking.bookingNumber}
          </p>
        </div>

        {/* Countdown */}
        {!isCancelled && days >= 0 && booking.status !== "COMPLETED" && (
          <div className="flex items-center gap-3 rounded-xl bg-indigo-50 px-5 py-3">
            <Timer className="size-5 text-indigo-600" />
            <div>
              <p className="text-lg font-bold text-indigo-700">
                {days} day{days !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-indigo-500">until your event</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      {!isCancelled && (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {PROGRESS_STEPS.map((step, idx) => {
                const isCompleted = idx <= progressIndex;
                const isCurrent = idx === progressIndex;
                return (
                  <div key={step.key} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                          isCompleted
                            ? "bg-indigo-600 text-white"
                            : "bg-zinc-100 text-zinc-400"
                        } ${isCurrent ? "ring-4 ring-indigo-100" : ""}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isCompleted ? "text-indigo-600" : "text-zinc-400"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < PROGRESS_STEPS.length - 1 && (
                      <div
                        className={`mx-2 h-0.5 flex-1 rounded ${
                          idx < progressIndex ? "bg-indigo-600" : "bg-zinc-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Main Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Event Details */}
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <CalendarCheck className="size-4 text-indigo-500" />
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Date
                  </p>
                  <p className="text-sm font-medium text-zinc-900">
                    {eventDate.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Time Slot
                  </p>
                  <p className="text-sm font-medium text-zinc-900">
                    {TIME_SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Guest Count
                  </p>
                  <p className="text-sm font-medium text-zinc-900">
                    {booking.guestCount} guests
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Total Amount
                  </p>
                  <p className="text-sm font-bold text-zinc-900">
                    {formatINR(booking.totalAmount)}
                  </p>
                </div>
              </div>

              {booking.specialRequests && (
                <div className="mt-5 rounded-lg bg-amber-50 p-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-amber-600" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                      Special Requests
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm text-amber-800">
                    {booking.specialRequests}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Venue Info */}
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <MapPin className="size-4 text-indigo-500" />
                Venue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">
                    {booking.venue.name}
                  </h3>
                  {booking.venue.description && (
                    <p className="mt-1 text-sm text-zinc-500">
                      {booking.venue.description}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-zinc-400" />
                    <span>Capacity: {booking.venue.capacity}</span>
                  </div>
                </div>
                {booking.venue.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {booking.venue.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600"
                      >
                        <Sparkles className="size-3 text-zinc-400" />
                        {amenity}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Event Preparation Progress (Summary Only — No Task Details) */}
          {eventProgress && (
            <div className="space-y-4">
              <EventProgressCard
                overallProgress={eventProgress.overallProgress}
                hasExecutionPlan={eventProgress.hasExecutionPlan}
              />
              <PhaseProgressList phases={eventProgress.phases} />
              <VendorReadinessCard
                confirmed={eventProgress.vendorReadiness.confirmed}
                total={eventProgress.vendorReadiness.total}
              />
            </div>
          )}

          {/* Linked Invoices */}
          {booking.invoices.length > 0 && (
            <Card className="border-zinc-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                  <FileText className="size-4 text-indigo-500" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {booking.invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/portal/invoices/${inv.id}`}
                      className="block"
                    >
                      <div className="flex items-center gap-4 rounded-lg border border-zinc-100 p-4 transition-colors hover:bg-zinc-50 hover:border-indigo-100">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-100">
                          <FileText className="size-5 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900">
                            {inv.invoiceNumber}
                          </p>
                          <p className="text-xs text-zinc-500">
                            Due:{" "}
                            {new Date(inv.dueDate).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-zinc-900">
                            {formatINR(inv.totalAmount)}
                          </p>
                          {inv.balanceDue > 0 && (
                            <p className="text-xs text-red-600 font-medium">
                              Due: {formatINR(inv.balanceDue)}
                            </p>
                          )}
                        </div>
                        <StatusBadge
                          status={inv.status}
                          colorMap={INVOICE_STATUS_COLORS}
                          className="text-[10px]"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Coordinator + Quick Info */}
        <div className="space-y-6">
          {/* Event Coordinator */}
          {booking.coordinator && (
            <Card className="border-zinc-200/80 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-zinc-900">
                  Your Coordinator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                      {booking.coordinator.name
                        ? booking.coordinator.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {booking.coordinator.name || "Coordinator"}
                      </p>
                      <p className="text-xs text-zinc-500">Event Coordinator</p>
                    </div>
                  </div>
                  {booking.coordinator.phone && (
                    <a
                      href={`tel:${booking.coordinator.phone}`}
                      className="flex items-center gap-2 rounded-lg border border-zinc-100 p-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
                    >
                      <Phone className="size-4 text-indigo-500" />
                      {booking.coordinator.phone}
                    </a>
                  )}
                  {booking.coordinator.email && (
                    <a
                      href={`mailto:${booking.coordinator.email}`}
                      className="flex items-center gap-2 rounded-lg border border-zinc-100 p-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-50"
                    >
                      <Mail className="size-4 text-indigo-500" />
                      <span className="truncate">
                        {booking.coordinator.email}
                      </span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Summary */}
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                <IndianRupee className="size-4 text-indigo-500" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Total Amount</span>
                  <span className="text-sm font-semibold text-zinc-900">
                    {formatINR(booking.totalAmount)}
                  </span>
                </div>
                {booking.invoices.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">Paid</span>
                      <span className="text-sm font-medium text-emerald-600">
                        {formatINR(
                          booking.invoices.reduce(
                            (sum, inv) => sum + Number(inv.paidAmount),
                            0
                          )
                        )}
                      </span>
                    </div>
                    <div className="h-px bg-zinc-100" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700">
                        Balance Due
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          booking.invoices.reduce(
                            (sum, inv) => sum + Number(inv.balanceDue),
                            0
                          ) > 0
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {formatINR(
                          booking.invoices.reduce(
                            (sum, inv) => sum + Number(inv.balanceDue),
                            0
                          )
                        )}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {(() => {
                      const totalPaid = booking.invoices.reduce(
                        (sum, inv) => sum + Number(inv.paidAmount),
                        0
                      );
                      const percent =
                        Number(booking.totalAmount) > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (totalPaid / Number(booking.totalAmount)) * 100
                              )
                            )
                          : 0;
                      return (
                        <div>
                          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                            <span>Payment progress</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card className="border-zinc-200/80 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-zinc-900">
                Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Booking #</span>
                  <span className="font-medium text-zinc-900">
                    {booking.bookingNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Created</span>
                  <span className="font-medium text-zinc-900">
                    {new Date(booking.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Event Type</span>
                  <span className="font-medium text-zinc-900">
                    {booking.eventType}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">Invoices</span>
                  <span className="font-medium text-zinc-900">
                    {booking.invoices.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Terms & Conditions */}
      <BookingTerms />
    </div>
  );
}
