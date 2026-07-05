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
import { prisma } from "@/lib/prisma";
import { RsvpForm } from "./_components/rsvp-form";

// ============================================================
// Public RSVP Page (No Auth Required)
// ============================================================

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
      <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
          <AlertTriangle className="size-6" />
        </div>
        <p className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          This invitation link isn&apos;t valid
        </p>
        <p className="mt-1.5 text-sm text-zinc-500">
          Please check with the couple for an updated invitation.
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
      <Card className="overflow-hidden border-zinc-200/80 shadow-lg">
        {/* Decorative Banner */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-10 text-center text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBoLTEydjRoMTJ6TTI0IDI0aDEydi0ySMjR2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          <p className="relative text-sm font-medium uppercase tracking-widest text-white/80">
            You are cordially invited to
          </p>
          <h1 className="relative mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {booking.eventName}
          </h1>
          <p className="relative mt-2 text-sm text-white/70">
            Hosted by {hostName}
          </p>
        </div>

        <CardContent className="space-y-6 p-6">
          {/* Guest Greeting */}
          <div className="text-center">
            <p className="text-lg text-zinc-700 dark:text-zinc-300">
              Dear <span className="font-semibold">{guest.name}</span>,
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              We would be honoured by your presence at this special occasion.
            </p>
          </div>

          {/* Event Details */}
          <div className="mx-auto grid max-w-sm gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <CalendarCheck className="size-5 flex-shrink-0 text-indigo-500" />
              <div>
                <p className="text-xs font-medium uppercase text-zinc-400">
                  Date
                </p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {formattedDate}
                </p>
              </div>
            </div>

            {formattedTime && (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <Clock className="size-5 flex-shrink-0 text-indigo-500" />
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-400">
                    Time
                  </p>
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {formattedTime}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <MapPin className="size-5 flex-shrink-0 text-indigo-500" />
              <div>
                <p className="text-xs font-medium uppercase text-zinc-400">
                  Venue
                </p>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {booking.venue.name}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RSVP Section */}
      {hasResponded ? (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardContent className="py-8 text-center">
            {isAccepted ? (
              <>
                <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
                <h2 className="mt-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Thank you for accepting!
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  We&apos;re thrilled you&apos;ll be joining us. See you at{" "}
                  {booking.eventName}!
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto size-12 text-zinc-400" />
                <h2 className="mt-3 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  We&apos;ll miss you!
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Thank you for letting us know. We hope to see you at a future
                  event.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-zinc-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Will you be attending?
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
