import { isHoldLapsed, type HoldFacts } from "@/lib/holds/lapsed-hold";
import { isCollectibleInvoice } from "@/lib/finance/issued-invoices";
import { INVOICE_STATUS_LABEL, customerLabel } from "@/lib/customer-app/status-labels";
import type { PublicSplitView } from "@/lib/payments/split-format";

// ============================================================
// /pay/split/<token>: what the payer is told, and whether they can pay — pure.
// ------------------------------------------------------------
// The page used to say "Nothing left to pay, already settled" whenever the
// invoice wasn't payable, even when the booking had been cancelled or its hold
// had lapsed. Each state now says what the records say:
//   SHARE_PAID           this share is paid
//   BOOKING_CANCELLED    the booking is cancelled
//   HOLD_LAPSED          a hold whose window passed with no money (lapsed-hold.ts)
//   LINK_EXPIRED         this share's link expired
//   LINK_CANCELLED       the host withdrew this share
//   SETTLED              the invoice is paid, or nothing is left on it
//   NOT_OPEN             the invoice isn't open for payment (draft, cancelled,
//                        refunded), or its state couldn't be read
//   EXCEEDS_OUTSTANDING  less is owed than this share
//   PAYABLE              show the checkout; the order action re-checks everything
//
// The booking's state comes before the link's: an expired link on a cancelled
// booking says the booking is cancelled, not "ask for a fresh link". A hold past
// its window that a checkout still protects stays PAYABLE: the order action may
// reopen this share's own open order, and refuses a new one in its own words.
// ============================================================

export type SplitPageState =
  | "SHARE_PAID"
  | "BOOKING_CANCELLED"
  | "HOLD_LAPSED"
  | "LINK_EXPIRED"
  | "LINK_CANCELLED"
  | "SETTLED"
  | "NOT_OPEN"
  | "EXCEEDS_OUTSTANDING"
  | "PAYABLE";

/** Read fresh for the page: the invoice's status and its booking's hold facts. */
export interface SplitInvoiceFacts {
  invoiceStatus: string;
  /** The booking's HOLD_FACTS_SELECT; null for an invoice with no booking. */
  booking: HoldFacts | null;
}

type SplitFields = Pick<PublicSplitView, "status" | "invoicePayable" | "exceedsOutstanding" | "outstandingPaise">;

/**
 * Where this share stands. `facts` null means they couldn't be read: the page
 * then never claims the invoice is settled, and falls back on the link's own
 * payable check.
 */
export function splitPageState(split: SplitFields, facts: SplitInvoiceFacts | null, now: Date = new Date()): SplitPageState {
  if (split.status === "PAID") return "SHARE_PAID";
  const booking = facts?.booking ?? null;
  if (booking?.status === "CANCELLED") return "BOOKING_CANCELLED";
  if (booking && isHoldLapsed(booking, now)) return "HOLD_LAPSED";
  if (split.status === "EXPIRED") return "LINK_EXPIRED";
  if (split.status === "CANCELLED") return "LINK_CANCELLED";
  if (facts) {
    if (facts.invoiceStatus === "PAID") return "SETTLED";
    // A share is paid only on an owed invoice: SENT, PARTIALLY_PAID or OVERDUE
    // (src/lib/finance/issued-invoices.ts; the same list as SPLIT_PAYABLE_INVOICE_STATUSES).
    if (!isCollectibleInvoice(facts.invoiceStatus)) return "NOT_OPEN";
    if (split.outstandingPaise <= 0) return "SETTLED";
  }
  if (!split.invoicePayable) return "NOT_OPEN";
  if (split.exceedsOutstanding) return "EXCEEDS_OUTSTANDING";
  return "PAYABLE";
}

export interface SplitStateCopy {
  tone: "success" | "warn" | "muted";
  title: string;
  body: string;
}

export interface SplitCopyContext {
  /** The host's first name, or "the host". */
  hostFirst: string;
  /** This share, formatted. */
  share: string;
  /** When the share was paid, formatted; null when unknown. */
  paidOn: string | null;
  /** What is still owed on the invoice, formatted. */
  outstanding: string;
  /** Invoice.status as read; null when unknown. */
  invoiceStatus: string | null;
  /** The booking is CANCELLED (told to a payer whose share is already paid). */
  bookingCancelled: boolean;
}

/** "the host withdrew…" at the start of a sentence reads "The host withdrew…". */
function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function splitStateCopy(state: Exclude<SplitPageState, "PAYABLE">, c: SplitCopyContext): SplitStateCopy {
  switch (state) {
    case "SHARE_PAID":
      return {
        tone: "success",
        title: "Your share is paid",
        body:
          `${c.share} received${c.paidOn ? ` on ${c.paidOn}` : ""}. Thank you — ${c.hostFirst} has been told.` +
          (c.bookingCancelled ? " This booking is now cancelled, so please contact us about your payment." : ""),
      };
    case "BOOKING_CANCELLED":
      return {
        tone: "warn",
        title: "This booking has been cancelled",
        body: `The date is no longer reserved, so nothing can be paid on this link. If you have questions, please contact ${c.hostFirst} or us.`,
      };
    case "HOLD_LAPSED":
      return {
        tone: "warn",
        title: "The hold on this date has lapsed",
        body: `The time to pay for this date ran out, so it is no longer reserved and nothing can be paid on this link. Please ask ${c.hostFirst} to start again.`,
      };
    case "LINK_EXPIRED":
      return {
        tone: "warn",
        title: "This link has expired",
        body: `Please ask ${c.hostFirst} to send you a fresh payment link.`,
      };
    case "LINK_CANCELLED":
      return {
        tone: "muted",
        title: "This link was cancelled",
        body: `${sentence(c.hostFirst)} withdrew this share. Nothing is due from you on this link.`,
      };
    case "SETTLED":
      return {
        tone: "success",
        title: "Nothing left to pay",
        body: "This invoice has already been settled. Thank you!",
      };
    case "NOT_OPEN": {
      const label = c.invoiceStatus ? customerLabel(INVOICE_STATUS_LABEL, c.invoiceStatus) : "";
      const why = label
        ? `It's marked "${label}" right now, so nothing can be paid on this link.`
        : "Nothing can be paid on this link right now.";
      return {
        tone: "muted",
        title: "This invoice isn't open for payment",
        body: `${why} Please ask ${c.hostFirst} or contact us.`,
      };
    }
    case "EXCEEDS_OUTSTANDING":
      return {
        tone: "warn",
        title: "This share needs updating",
        body: `Only ${c.outstanding} is still due on this invoice, which is less than your share. Please ask ${c.hostFirst} for a fresh link.`,
      };
  }
}
