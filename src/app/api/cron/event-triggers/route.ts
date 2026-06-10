import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { triggerWorkflows } from "@/lib/workflow-executor";

export const maxDuration = 120;

// ============================================================
// Date-based workflow triggers: EVENT_TOMORROW + POST_EVENT
// ============================================================
// Fires the pre-event reminder for bookings happening tomorrow and the
// post-event NPS for bookings that happened yesterday. The matching
// workflow rules are seeded in prisma/bootstrap.ts. Runs daily (invoked
// by /api/cron/daily).

/** UTC midnight for "today + offsetDays" and the next day (range query). */
function dayRange(offsetDays: number): { gte: Date; lt: Date } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() + offsetDays);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let preEvent = 0;
    let postEvent = 0;

    // EVENT_TOMORROW — bookings happening tomorrow (active statuses only)
    const tomorrow = dayRange(1);
    const upcoming = await prisma.booking.findMany({
      where: {
        date: { gte: tomorrow.gte, lt: tomorrow.lt },
        status: { in: ["CONFIRMED", "IN_PROGRESS", "TENTATIVE"] },
      },
      select: { id: true, contactId: true },
    });
    for (const b of upcoming) {
      await triggerWorkflows("EVENT_TOMORROW", {
        bookingId: b.id,
        contactId: b.contactId,
      });
      preEvent++;
    }

    // POST_EVENT — bookings that happened yesterday (not cancelled)
    const yesterday = dayRange(-1);
    const finished = await prisma.booking.findMany({
      where: {
        date: { gte: yesterday.gte, lt: yesterday.lt },
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true, contactId: true },
    });
    for (const b of finished) {
      await triggerWorkflows("POST_EVENT", {
        bookingId: b.id,
        contactId: b.contactId,
      });
      postEvent++;
    }

    return NextResponse.json({ success: true, preEvent, postEvent });
  } catch (error) {
    console.error("[EVENT_TRIGGERS_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
