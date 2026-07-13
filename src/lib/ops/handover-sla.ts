import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";

// ============================================================
// Handover-meeting 24h SLA watchdog. Nags the booking owner once when a handover
// is still PENDING past its slaDueAt (24h from confirmation). Idempotent via
// slaNaggedAt. Best-effort — never throws (runs in the daily cron lane).
// ============================================================

export async function runHandoverSlaChecks(): Promise<{ handoverNagged: number }> {
  const now = new Date();
  let nagged = 0;
  try {
    const overdue = await prisma.handoverMeeting.findMany({
      // Skip meetings whose booking is no longer active — never nag about a
      // cancelled/completed event's handover.
      where: {
        status: "PENDING", slaDueAt: { lt: now }, slaNaggedAt: null,
        booking: { status: { notIn: ["CANCELLED", "COMPLETED"] } },
      },
      select: {
        id: true,
        bookingId: true,
        booking: { select: { bookingNumber: true, eventName: true, createdById: true } },
      },
      take: 200,
    });
    for (const m of overdue) {
      try {
        if (m.booking?.createdById) {
          await notifyAwait({
            userId: m.booking.createdById,
            type: "SYSTEM",
            title: "Handover meeting overdue (24h SLA)",
            message: `The Sales→Ops handover for ${m.booking.bookingNumber} (${m.booking.eventName}) is past its 24h SLA — schedule it now.`,
            actionUrl: `/bookings/${m.bookingId}`,
          });
        }
        await prisma.handoverMeeting.update({ where: { id: m.id }, data: { slaNaggedAt: now } });
        nagged++;
      } catch (e) {
        console.error("[HANDOVER_SLA_ROW_ERR]", m.id, e);
      }
    }
  } catch (e) {
    console.error("[HANDOVER_SLA_ERR]", e);
  }
  return { handoverNagged: nagged };
}
