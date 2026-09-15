import { prisma } from "@/lib/prisma";
import { PAID_WITHOUT_SLOT_ACTION } from "@/lib/holds/paid-without-slot";

// ============================================================
// "We've told our team": said only when the team's alert is on record.
// ------------------------------------------------------------
// alertPaymentOnCancelledBooking (src/lib/holds/paid-without-slot.ts) records
// an ActivityLog row on the Payment before it alerts the booking's owner and
// the admins. The /pay result and the paid /hold page read that row through
// this one lookup before telling a customer the team knows.
// Server only.
// ============================================================

/**
 * Is the team's alert about any of these payments landing on a cancelled
 * booking on record? false for no payments, and when it can't be read.
 */
export async function cancelledBookingAlertOnRecord(paymentIds: readonly string[]): Promise<boolean> {
  const ids = [...new Set(paymentIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) return false;
  try {
    const row = await prisma.activityLog.findFirst({
      where: {
        entityType: "Payment",
        entityId: ids.length === 1 ? ids[0] : { in: ids },
        action: PAID_WITHOUT_SLOT_ACTION.PAYMENT_ON_CANCELLED_BOOKING,
      },
      select: { id: true },
    });
    return row !== null;
  } catch (e) {
    console.error("[PAY_OUTCOME_ALERT_LOOKUP_ERROR]", e);
    return false;
  }
}
