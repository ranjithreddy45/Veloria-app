import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { BookingTerms } from "@/components/legal/booking-terms";
import {
  ArrowLeft,
  CalendarCheck,
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
  BOOKING_STATUS_CLIENT_LABELS,
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
  { key: "HOLD", label: "Reserved" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_PROGRESS", label: "In progress" },
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
    <div className="space-y-10">
      {/* Back Button */}
      <Link
        href="/portal/bookings"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-[13px] transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to my bookings
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
            Your celebration
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="large-title text-foreground text-[28px] leading-tight sm:text-[32px]">
              {booking.eventName}
            </h1>
            <StatusBadge
              status={booking.status}
              colorMap={BOOKING_STATUS_COLORS}
              label={BOOKING_STATUS_CLIENT_LABELS[booking.status]}
            />
          </div>
          <p className="text-muted-foreground text-[15px]">
            {booking.eventType} &middot; Booking{" "}
            <span className="numeric">{booking.bookingNumber}</span>
          </p>
        </div>

        {/* Countdown */}
        {!isCancelled && days >= 0 && booking.status !== "COMPLETED" && (
          <div className="bg-primary/[0.06] border-primary/15 flex flex-shrink-0 items-center gap-3.5 rounded-2xl border px-5 py-4">
            <Timer className="text-primary size-5" />
            <div>
              <p className="numeric text-foreground text-[20px] font-semibold leading-none">
                {days} day{days !== 1 ? "s" : ""}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                Until your event
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress Timeline */}
      {!isCancelled && (
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {PROGRESS_STEPS.map((step, idx) => {
                const isCompleted = idx <= progressIndex;
                const isCurrent = idx === progressIndex;
                return (
                  <div key={step.key} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground/50"
                        } ${isCurrent ? "ring-primary/15 ring-4" : ""}`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </div>
                      <span
                        className={`text-center text-[11px] font-semibold uppercase tracking-[0.1em] ${
                          isCompleted
                            ? "text-primary"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < PROGRESS_STEPS.length - 1 && (
                      <div
                        className={`mx-2 mb-6 h-0.5 flex-1 rounded-full ${
                          idx < progressIndex ? "bg-primary" : "bg-border"
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
          <Card className="shadow-card rounded-2xl py-0">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className="flex items-center gap-2.5">
                <CalendarCheck className="text-primary size-4" />
                <span className="font-editorial text-foreground text-[20px] font-semibold">
                  Your day, in detail
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Date
                  </p>
                  <p className="numeric text-foreground text-sm font-medium">
                    {eventDate.toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Time slot
                  </p>
                  <p className="text-foreground text-sm font-medium">
                    {TIME_SLOT_LABELS[booking.timeSlot] || booking.timeSlot}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Guests
                  </p>
                  <p className="text-foreground text-sm font-medium">
                    <span className="numeric">{booking.guestCount}</span> guests
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.14em]">
                    Total
                  </p>
                  <p className="numeric text-foreground text-sm font-semibold">
                    {formatINR(booking.totalAmount)}
                  </p>
                </div>
              </div>

              {booking.specialRequests && (
                <div className="border-warning/30 bg-warning/[0.08] mt-6 rounded-xl border p-4">
                  <div className="text-warning flex items-center gap-2">
                    <MessageSquare className="size-3.5" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                      What you asked us for
                    </p>
                  </div>
                  <p className="text-foreground/80 mt-2 text-sm leading-relaxed">
                    {booking.specialRequests}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Venue Info */}
          <Card className="shadow-card rounded-2xl py-0">
            <CardHeader className="px-6 pt-6 pb-4">
              <CardTitle className="flex items-center gap-2.5">
                <MapPin className="text-primary size-4" />
                <span className="font-editorial text-foreground text-[20px] font-semibold">
                  Where it happens
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">
                    {booking.venue.name}
                  </h3>
                  {booking.venue.description && (
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                      {booking.venue.description}
                    </p>
                  )}
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Users className="text-muted-foreground/50 size-3.5" />
                    <span>
                      Seats up to{" "}
                      <span className="numeric">{booking.venue.capacity}</span>
                    </span>
                  </div>
                </div>
                {booking.venue.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {booking.venue.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                      >
                        <Sparkles className="text-muted-foreground/50 size-3" />
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
            <Card className="shadow-card rounded-2xl py-0">
              <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="flex items-center gap-2.5">
                  <FileText className="text-primary size-4" />
                  <span className="font-editorial text-foreground text-[20px] font-semibold">
                    Invoices
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-3">
                  {booking.invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/portal/invoices/${inv.id}`}
                      className="block"
                    >
                      <div className="hover:bg-muted/60 flex items-center gap-4 rounded-xl border p-4 transition-colors">
                        <div className="bg-muted flex size-10 flex-shrink-0 items-center justify-center rounded-xl">
                          <FileText className="text-muted-foreground/70 size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="numeric text-foreground text-sm font-medium">
                            {inv.invoiceNumber}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Due{" "}
                            <span className="numeric">
                              {new Date(inv.dueDate).toLocaleDateString(
                                "en-IN",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="numeric text-foreground text-sm font-semibold">
                            {formatINR(inv.totalAmount)}
                          </p>
                          {inv.balanceDue > 0 && (
                            <p className="numeric text-destructive text-xs font-medium">
                              {formatINR(inv.balanceDue)} due
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
            <Card className="shadow-card rounded-2xl py-0">
              <CardHeader className="px-6 pb-4 pt-6">
                <CardTitle className="font-editorial text-foreground text-[20px] font-semibold">
                  Your coordinator
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl text-sm font-semibold">
                      {booking.coordinator.name
                        ? booking.coordinator.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-semibold">
                        {booking.coordinator.name || "Coordinator"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Here for you, start to finish
                      </p>
                    </div>
                  </div>
                  {booking.coordinator.phone && (
                    <a
                      href={`tel:${booking.coordinator.phone}`}
                      className="text-foreground hover:bg-muted/60 flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors"
                    >
                      <Phone className="text-primary size-4 shrink-0" />
                      <span className="numeric">
                        {booking.coordinator.phone}
                      </span>
                    </a>
                  )}
                  {booking.coordinator.email && (
                    <a
                      href={`mailto:${booking.coordinator.email}`}
                      className="text-foreground hover:bg-muted/60 flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors"
                    >
                      <Mail className="text-primary size-4 shrink-0" />
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
          <Card className="shadow-card rounded-2xl py-0">
            <CardHeader className="px-6 pb-4 pt-6">
              <CardTitle className="flex items-center gap-2.5">
                <IndianRupee className="text-primary size-4" />
                <span className="font-editorial text-foreground text-[20px] font-semibold">
                  Where you stand
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="numeric text-foreground font-medium">
                    {formatINR(booking.totalAmount)}
                  </span>
                </div>
                {booking.invoices.length > 0 && (
                  <>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="numeric text-success font-medium">
                        {formatINR(
                          booking.invoices.reduce(
                            (sum, inv) => sum + Number(inv.paidAmount),
                            0
                          )
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t pt-3">
                      <span className="text-foreground text-sm font-semibold">
                        Balance due
                      </span>
                      <span
                        className={`numeric text-[17px] font-semibold ${
                          booking.invoices.reduce(
                            (sum, inv) => sum + Number(inv.balanceDue),
                            0
                          ) > 0
                            ? "text-destructive"
                            : "text-success"
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
                        <div className="pt-1">
                          <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em]">
                            <span>Settled</span>
                            <span className="numeric">{percent}%</span>
                          </div>
                          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-500"
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
          <Card className="shadow-card rounded-2xl py-0">
            <CardHeader className="px-6 pb-4 pt-6">
              <CardTitle className="font-editorial text-foreground text-[20px] font-semibold">
                At a glance
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Booking</span>
                  <span className="numeric text-foreground font-medium">
                    {booking.bookingNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span className="numeric text-foreground font-medium">
                    {new Date(booking.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Event type</span>
                  <span className="text-foreground text-right font-medium">
                    {booking.eventType}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="numeric text-foreground font-medium">
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
