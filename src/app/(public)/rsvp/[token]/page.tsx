import {
  CalendarCheck,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { RsvpForm } from "./_components/rsvp-form";

// ============================================================
// Public RSVP Page (No Auth Required)
// ============================================================

export const metadata: Metadata = {
  title: "RSVP — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized invite; keep out of search
};

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Fetch invitation with guest + booking details
  const invitation = await prisma.guestInvitation.findUnique({
    where: { rsvpToken: token },
    include: {
      guest: {
        select: { name: true, plusOnes: true, dietaryRestrictions: true },
      },
      booking: {
        include: {
          venue: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!invitation) {
    return (
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning/12 text-warning">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="text-foreground mt-5 text-h2">
          This invitation link isn&apos;t valid
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-sm leading-relaxed">
          Do check with your hosts — they can send you a fresh invitation.
        </p>
      </div>
    );
  }

  const { guest, booking } = invitation;
  const eventDate = new Date(booking.date);
  const hasResponded = !!invitation.rsvpRespondedAt;
  const isAccepted = invitation.invitationStatus === "RSVP_ACCEPTED";

  // booking.date is a @db.Date (UTC midnight) → format in UTC so the calendar
  // day never shifts on a UTC server. booking.startTime is a full DateTime
  // stored as an IST wall-clock instant → format in Asia/Kolkata.
  const formattedDate = eventDate.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const formattedTime = booking.startTime
    ? new Date(booking.startTime).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : null;

  const hostName = `${booking.contact.firstName} ${booking.contact.lastName}`;

  return (
    <div className="space-y-6">
      {/* Event Invitation Card */}
      <Card className="shadow-card overflow-hidden rounded-2xl py-0">
        {/* Invitation plate — quiet ink, editorial type */}
        <div className="relative overflow-hidden bg-zinc-950 px-6 py-14 text-center text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-4 rounded-xl border border-white/12"
          />
          <div className="relative">
            <p className="text-meta font-semibold uppercase tracking-[0.28em] text-white/55">
              You are cordially invited to
            </p>
            <h1 className="mt-5 text-h1 text-white sm:text-display">
              {booking.eventName}
            </h1>
            <div
              aria-hidden
              className="mx-auto mt-5 h-px w-14 bg-white/25"
            />
            <p className="mt-5 text-body tracking-wide text-white/60">
              Hosted by {hostName}
            </p>
          </div>
        </div>

        <CardContent className="space-y-7 px-6 py-8">
          {/* Guest Greeting */}
          <div className="text-center">
            <p className="font-editorial text-foreground text-title">
              Dear {guest.name},
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
              We would be honoured by your presence at this special occasion.
            </p>
          </div>

          {/* Event Details */}
          <div className="mx-auto grid max-w-sm gap-2.5">
            <div className="bg-muted/40 flex items-center gap-3.5 rounded-xl border p-3.5">
              <CalendarCheck className="text-muted-foreground/60 size-5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground/70 text-meta font-semibold uppercase tracking-[0.14em]">
                  Date
                </p>
                <p className="text-foreground mt-0.5 text-sm font-semibold">
                  {formattedDate}
                </p>
              </div>
            </div>

            {formattedTime && (
              <div className="bg-muted/40 flex items-center gap-3.5 rounded-xl border p-3.5">
                <Clock className="text-muted-foreground/60 size-5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-muted-foreground/70 text-meta font-semibold uppercase tracking-[0.14em]">
                    Time
                  </p>
                  <p className="numeric text-foreground mt-0.5 text-sm font-semibold">
                    {formattedTime}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-muted/40 flex items-center gap-3.5 rounded-xl border p-3.5">
              <MapPin className="text-muted-foreground/60 size-5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-muted-foreground/70 text-meta font-semibold uppercase tracking-[0.14em]">
                  Venue
                </p>
                <p className="text-foreground mt-0.5 text-sm font-semibold">
                  {booking.venue.name}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RSVP Section */}
      {hasResponded ? (
        <Card className="shadow-card rounded-2xl">
          <CardContent className="py-10 text-center">
            {isAccepted ? (
              <>
                <CheckCircle2 className="mx-auto size-11 text-success" />
                <h2 className="font-editorial text-foreground mt-4 text-h2 font-semibold">
                  Thank you for accepting
                </h2>
                <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
                  We&apos;re delighted you&apos;ll be joining us. See you at{" "}
                  {booking.eventName}.
                </p>
              </>
            ) : (
              <>
                <XCircle className="text-muted-foreground/50 mx-auto size-11" />
                <h2 className="font-editorial text-foreground mt-4 text-h2 font-semibold">
                  You&apos;ll be missed
                </h2>
                <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
                  Thank you for letting us know — we hope to welcome you at a
                  future occasion.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-editorial text-foreground text-center text-title font-semibold">
              Will you be joining us?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RsvpForm token={token} guestName={guest.name} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
