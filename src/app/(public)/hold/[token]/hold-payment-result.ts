import {
  CANCELLED_BOOKING_TITLE,
  cancelledBookingNotice,
  type OutcomeBookingState,
} from "@/app/pay/[token]/outcome-state";

// ============================================================
// /hold/<token> after a payment: what the customer is told — pure.
// ------------------------------------------------------------
// The same outcome state the /pay result uses (src/app/pay/[token]/outcome-state.ts):
//   LIVE       TENTATIVE, CONFIRMED or IN_PROGRESS, or a HOLD with money against
//              it: the date is secured, and only then is that said.
//   CANCELLED  the payment is received and recorded but the booking isn't
//              active; "we've told our team" only when the alert is on record.
//   INACTIVE   anything else (a completed event): the payment, nothing more.
// And two for what the page doesn't know:
//   CHECKING   the payment was verified and its outcome is still loading.
//   UNKNOWN    the outcome couldn't be read, or the hold has no booking.
// Only LIVE says the date is secured or blocked.
// ============================================================

export type HoldPaymentState = OutcomeBookingState | "CHECKING" | "UNKNOWN";

export interface HoldPaymentCopy {
  tone: "success" | "warn" | "neutral";
  /** The page's heading. */
  heading: string;
  title: string;
  lines: string[];
  /** Lead with the contact buttons: the customer needs to reach the team. */
  contactFirst: boolean;
}

export function holdPaymentCopy(state: HoldPaymentState, c: { amount: string; teamAlerted: boolean }): HoldPaymentCopy {
  switch (state) {
    case "LIVE":
      return {
        tone: "success",
        heading: "Your date is secured",
        title: "Payment received — your date is secured",
        lines: [`Payment of ${c.amount} received — this date is now blocked for you.`, "Our team will be in touch about the next steps."],
        contactFirst: false,
      };
    case "CANCELLED":
      return {
        tone: "warn",
        heading: "Payment received",
        title: CANCELLED_BOOKING_TITLE,
        lines: [cancelledBookingNotice(c.teamAlerted)],
        contactFirst: true,
      };
    case "INACTIVE":
      return {
        tone: "neutral",
        heading: "Payment received",
        title: "Payment received",
        lines: [`Payment of ${c.amount} received and recorded.`, "If you have a question about your booking, please contact us."],
        contactFirst: true,
      };
    case "CHECKING":
      return {
        tone: "neutral",
        heading: "Payment received",
        title: "Payment received",
        lines: [`Payment of ${c.amount} received. Checking your booking…`],
        contactFirst: false,
      };
    case "UNKNOWN":
      return {
        tone: "neutral",
        heading: "Payment received",
        title: "Payment received",
        lines: [
          `Payment of ${c.amount} received and recorded.`,
          "We couldn't load your booking's status just now. If you have a question about it, please contact us.",
        ],
        contactFirst: true,
      };
  }
}
