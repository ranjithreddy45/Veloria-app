import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/lead-capture";

// ============================================================
// On booking confirmation, provision the post-sale SLA artifacts:
//  - a 24h Sales→Ops HANDOVER meeting (PENDING) + a companion HIGH-priority Task,
//  - a 48h GUEST-CONFIRMATION deadline (TAT) + a token for the guest app-link flow.
// Idempotent (upsert / set-once / task-dedupe) and best-effort — never throws, so a
// confirmation is never blocked by artifact setup. Called from BOTH confirm paths
// (manual confirmBooking + payment-driven maybeConfirmBookingOnPayment).
// ============================================================

const HANDOVER_SLA_HOURS = 24;
const GUEST_CONFIRM_TAT_HOURS = 48;

export async function initBookingConfirmationArtifacts(bookingId: string, actorId?: string | null): Promise<void> {
  try {
    const now = new Date();
    const slaDueAt = new Date(now.getTime() + HANDOVER_SLA_HOURS * 3600_000);
    const guestDueAt = new Date(now.getTime() + GUEST_CONFIRM_TAT_HOURS * 3600_000);

    // 48h guest-confirmation deadline + token — set ONCE (never reset on re-confirm).
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { guestConfirmationDueAt: true, guestConfirmationToken: true },
    });
    if (b && !b.guestConfirmationDueAt) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          guestConfirmationDueAt: guestDueAt,
          guestConfirmationToken: b.guestConfirmationToken ?? randomUUID().replace(/-/g, ""),
        },
      });
    }

    // Handover meeting — one per booking, PENDING with a 24h SLA. Don't disturb an
    // existing one (it may already be SCHEDULED/COMPLETED).
    await prisma.handoverMeeting.upsert({
      where: { bookingId },
      create: { bookingId, status: "PENDING", slaDueAt, createdById: actorId ?? null },
      update: {},
    });

    // Companion 24h SLA task for Sales to actually schedule the handover.
    const creatorId = actorId ?? (await getSystemUserId());
    if (creatorId) {
      const exists = await prisma.task.findFirst({
        where: { bookingId, title: { startsWith: "Arrange Sales→Ops handover" } },
        select: { id: true },
      });
      if (!exists) {
        await prisma.task.create({
          data: {
            title: "Arrange Sales→Ops handover meeting",
            description:
              "Schedule the guest-introduction / handover meeting with the Ops/Event team within 24h of booking confirmation (physical or virtual, in-app).",
            dueDate: slaDueAt,
            priority: "HIGH",
            bookingId,
            creatorId,
          },
        });
      }
    }
  } catch (e) {
    console.error("[BOOKING_CONFIRM_ARTIFACTS_ERR]", bookingId, e);
  }
}
