import { prisma } from "@/lib/prisma";
import { getHostScope, isStaffUser } from "@/lib/guest/host-scope";
import { bookingCalendarFile } from "../event-ics";
import { calendarTokenSecret, verifyCalendarToken } from "../calendar-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// GET /api/guest/calendar/<bookingId>: an .ics "Add to calendar" file.
// /api/guest/** skips middleware, so access is decided here. Either:
//   - the signed-in viewer can see this booking (getHostScope: their own or an
//     invited booking, or staff preview), or
//   - ?t= is a valid short-lived token minted after a verified payment on /pay
//     for THIS booking (see calendar-token.ts).
// Times come from the booking in IST (event-ics.ts). A cancelled booking has
// no event to add.
// ============================================================

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const token = new URL(req.url).searchParams.get("t");

  let allowed = !!token && verifyCalendarToken(token, bookingId, calendarTokenSecret(), Date.now());
  if (!allowed) {
    const scope = await getHostScope(bookingId);
    if (!scope) {
      return plain(
        token
          ? "This calendar link has expired. Open your event in the Veloria Grand app to add it again."
          : "Please sign in to the Veloria Grand app to add this event to your calendar.",
        401
      );
    }
    // Booking basics are what bookings:read opens on the team side; preview is
    // for team members who hold it by their effective permissions, so fail closed for anyone else.
    allowed = !!scope.booking && scope.booking.id === bookingId && (!scope.preview || isStaffUser(scope.user));
  }
  if (!allowed) return plain("We couldn't find that event.", 404);

  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      bookingNumber: true,
      eventName: true,
      status: true,
      date: true,
      timeSlot: true,
      startTime: true,
      endTime: true,
      eventStartAt: true,
      venue: { select: { name: true, publicAddress: true } },
    },
  });
  if (!b || b.status === "CANCELLED") return plain("We couldn't find that event.", 404);

  const file = bookingCalendarFile(
    {
      id: b.id,
      bookingNumber: b.bookingNumber,
      eventName: b.eventName,
      status: b.status,
      date: b.date,
      timeSlot: b.timeSlot,
      startTime: b.startTime,
      endTime: b.endTime,
      eventStartAt: b.eventStartAt,
      venueName: b.venue?.name ?? null,
      venueAddress: b.venue?.publicAddress ?? null,
    },
    // Only a configured public URL goes into the file: behind the proxy, the
    // request origin is the internal address.
    { generatedAt: new Date(), appUrl: process.env.NEXT_PUBLIC_APP_URL || null }
  );

  return new Response(file.body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // inline: iOS Safari then offers "Add to Calendar" instead of saving a file.
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
