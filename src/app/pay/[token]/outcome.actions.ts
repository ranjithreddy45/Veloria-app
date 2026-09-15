"use server";

import { prisma } from "@/lib/prisma";
import { BOOKING_STATUS_LABEL, INVOICE_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import { CALENDAR_TOKEN_TTL_MS, calendarTokenSecret, signCalendarToken } from "@/app/api/guest/calendar/calendar-token";
import { money } from "@/app/api/guest/receipt/guest-money";
import { HOLD_FACTS_SELECT } from "@/lib/holds/lapsed-hold";
import { outcomeBookingState, type OutcomeBookingState } from "./outcome-state";
import { cancelledBookingAlertOnRecord } from "./payment-alert";

// ============================================================
// /pay: what actually happened, read back after a verified payment.
// ------------------------------------------------------------
// PUBLIC (a /pay link needs no login). The credential is the Razorpay order id
// AND payment id pair that checkout just handed this browser: the payment is
// only returned when both match one COMPLETED Payment row, which the verify
// call has already credited. Everything returned is read from the records
// finance uses: the receipt number from the shared counter, Payment.amount,
// Invoice.balanceDue and the booking's real status (after auto-confirm ran).
// It adds nothing a payer does not already know except the receipt details,
// and mints an "Add to calendar" link for that booking only.
// ============================================================

export interface PaymentOutcome {
  receiptNumber: string | null;
  /** Payment.amount */
  amountPaid: number;
  paidAt: string | null;
  invoiceNumber: string;
  invoiceStatusLabel: string;
  /** Invoice.balanceDue, now. */
  balanceDue: number;
  booking: {
    status: string;
    statusLabel: string;
    eventName: string;
    dateLabel: string;
    /**
     * LIVE: the booking is on (TENTATIVE, CONFIRMED, IN_PROGRESS, or a HOLD with
     * money against it), so the app and calendar links are offered. CANCELLED:
     * the payment landed on a cancelled booking. INACTIVE: anything else, such
     * as a completed event. See outcome-state.ts.
     */
    state: OutcomeBookingState;
    /** CANCELLED only: the team's alert about this payment is on record (src/lib/holds/paid-without-slot.ts). */
    teamAlerted: boolean;
    /** Signed short-lived link; null unless the booking is LIVE, or when links can't be signed. */
    calendarUrl: string | null;
  } | null;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ORDER_ID = /^order_[A-Za-z0-9]{6,40}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{6,40}$/;

export async function getPublicPaymentOutcome(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): Promise<Result<PaymentOutcome>> {
  const orderId = typeof input?.razorpayOrderId === "string" ? input.razorpayOrderId : "";
  const paymentId = typeof input?.razorpayPaymentId === "string" ? input.razorpayPaymentId : "";
  if (!ORDER_ID.test(orderId) || !PAYMENT_ID.test(paymentId)) {
    return { success: false, error: "We couldn't find that payment." };
  }
  try {
    const p = await prisma.payment.findFirst({
      where: { razorpayOrderId: orderId, transactionId: paymentId, status: "COMPLETED" },
      select: {
        id: true,
        amount: true,
        receiptNumber: true,
        paidAt: true,
        invoice: {
          select: {
            invoiceNumber: true,
            status: true,
            balanceDue: true,
            // The booking's status, hold window and money on all its invoices,
            // so "live" follows the one hold rule (outcome-state.ts).
            booking: { select: { ...HOLD_FACTS_SELECT, eventName: true, date: true } },
          },
        },
      },
    });
    if (!p) return { success: false, error: "We couldn't load the receipt details yet." };

    const b = p.invoice.booking;
    const state = b ? outcomeBookingState(b) : null;
    // "We've told our team" is said only when the alert about this payment is on
    // record: alertPaymentOnCancelledBooking records it on the Payment before
    // alerting the booking's owner and the admins.
    const teamAlerted = state === "CANCELLED" ? await cancelledBookingAlertOnRecord([p.id]) : false;
    const secret = calendarTokenSecret();
    const calendarUrl =
      b && state === "LIVE" && secret
        ? `/api/guest/calendar/${encodeURIComponent(b.id)}?t=${encodeURIComponent(
            signCalendarToken(b.id, Date.now() + CALENDAR_TOKEN_TTL_MS, secret)
          )}`
        : null;

    return {
      success: true,
      data: {
        receiptNumber: p.receiptNumber,
        amountPaid: money(p.amount),
        paidAt: p.paidAt?.toISOString() ?? null,
        invoiceNumber: p.invoice.invoiceNumber,
        invoiceStatusLabel: customerLabel(INVOICE_STATUS_LABEL, p.invoice.status),
        balanceDue: money(p.invoice.balanceDue),
        booking:
          b && state
            ? {
                status: b.status,
                statusLabel: customerLabel(BOOKING_STATUS_LABEL, b.status),
                eventName: b.eventName,
                dateLabel: b.date.toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "Asia/Kolkata",
                }),
                state,
                teamAlerted,
                calendarUrl,
              }
            : null,
      },
    };
  } catch (e) {
    console.error("[PAY_OUTCOME_ERROR]", e);
    return { success: false, error: "We couldn't load the receipt details." };
  }
}
