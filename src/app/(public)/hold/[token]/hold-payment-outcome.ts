import { prisma } from "@/lib/prisma";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { outcomeBookingState, type OutcomeBookingState } from "@/app/pay/[token]/outcome-state";
import { cancelledBookingAlertOnRecord } from "@/app/pay/[token]/payment-alert";

// ============================================================
// /hold/<token>, paid: the booking's outcome, read the way /pay reads it.
// ------------------------------------------------------------
// The state is outcomeBookingState over the booking's hold facts (its status,
// its window and the money on every invoice). "The team has been told" is the
// alert on record for a completed payment on the hold's own token invoice
// (src/app/pay/[token]/payment-alert.ts). The token is the credential, as for
// getPublicHold, and nothing beyond these two facts is returned.
// Server only. Never throws: null when the hold has no booking, or on an error.
// ============================================================

export interface HoldPaymentOutcome {
  state: OutcomeBookingState;
  /** CANCELLED only: the team's alert about the token payment is on record. */
  teamAlerted: boolean;
}

export async function getHoldPaymentOutcome(token: string, now: Date = new Date()): Promise<HoldPaymentOutcome | null> {
  try {
    const hold = await prisma.publicHold.findUnique({
      where: { token },
      select: { bookingId: true, invoiceId: true },
    });
    if (!hold?.bookingId) return null;

    const booking = await prisma.booking.findUnique({
      where: { id: hold.bookingId },
      select: {
        ...HOLD_FACTS_SELECT,
        invoices: {
          select: {
            ...HOLD_FACTS_SELECT.invoices.select,
            id: true,
            payments: { select: { ...HOLD_FACTS_SELECT.invoices.select.payments.select, id: true } },
          },
        },
      },
    });
    if (!booking) return null;

    const state = outcomeBookingState(booking, now);
    if (state !== "CANCELLED") return { state, teamAlerted: false };

    const paymentIds = booking.invoices
      .filter((inv) => !hold.invoiceId || inv.id === hold.invoiceId)
      .flatMap((inv) => inv.payments.filter((p) => p.status === "COMPLETED").map((p) => p.id));
    return { state, teamAlerted: await cancelledBookingAlertOnRecord(paymentIds) };
  } catch (e) {
    console.error("[HOLD_PAYMENT_OUTCOME_ERROR]", e);
    return null;
  }
}
