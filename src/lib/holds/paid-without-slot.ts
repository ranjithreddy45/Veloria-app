import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { reportSystemFailure } from "@/lib/ops-alert";
import { formatINR } from "@/lib/utils";
import { slotLabel } from "@/lib/sales/slot";
import { utcDayRange } from "@/lib/sales/slot-util";
import { findLapsedHoldIds } from "./release-lapsed-holds";
import { slotIsFree, withoutLapsedHolds } from "./slot-occupancy";

// ============================================================
// Money captured, but no live booking for it — tell the team, once.
// ------------------------------------------------------------
// Two ways a customer's payment can land with no booking behind it:
//
//  - PAYMENT_ON_CANCELLED_BOOKING: a checkout left open past its 15-minute
//    grace is captured after the hold was released, or the team cancelled the
//    booking while the customer was paying.
//  - ONE_TAP_SLOT_TAKEN: a one-tap quote advance is captured, but the slot was
//    taken before the booking could be created.
//
// Either way the payment is already recorded against its invoice (never
// dropped), and nothing is confirmed onto a slot someone else may hold. What is
// missing is a person who knows. This alerts the sale's owner and every admin
// with what happened and what to do: re-book or refund.
//
// Once per payment: an ActivityLog row on the Payment is claimed inside a
// transaction holding a Postgres advisory lock on that payment (the pattern
// src/lib/otp.ts uses). The browser verify call, the webhook, a webhook
// re-delivery and a retried finalize may all get here; only the first alerts.
// If the claim itself fails, the alert still goes out: a duplicate costs a
// glance, a missing one leaves a customer's money unnoticed.
//
// Never throws.
// ============================================================

export type PaidWithoutSlotKind = "PAYMENT_ON_CANCELLED_BOOKING" | "ONE_TAP_SLOT_TAKEN";

/** ActivityLog action per kind; entityType "Payment", entityId the payment. */
export const PAID_WITHOUT_SLOT_ACTION: Record<PaidWithoutSlotKind, string> = {
  PAYMENT_ON_CANCELLED_BOOKING: "alerted_payment_on_cancelled_booking",
  ONE_TAP_SLOT_TAKEN: "alerted_one_tap_slot_taken",
};

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export interface PaidWithoutSlotAlert {
  kind: PaidWithoutSlotKind;
  paymentId: string;
  /** Staff who own the sale. Told directly unless they are admins (every active admin is told anyway). */
  ownerIds: readonly (string | null | undefined)[];
  title: string;
  message: string;
  actionUrl: string;
  /** Recorded on the ActivityLog row next to the message. */
  facts?: Record<string, unknown>;
}

/** Claim the alert for this payment. true when this call is the first. Throws on a database error. */
async function claimAlert(a: PaidWithoutSlotAlert, actorId: string): Promise<boolean> {
  const action = PAID_WITHOUT_SLOT_ACTION[a.kind];
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${action}:${a.paymentId}`}))`;
    const already = await tx.activityLog.findFirst({
      where: { entityType: "Payment", entityId: a.paymentId, action },
      select: { id: true },
    });
    if (already) return false;
    await tx.activityLog.create({
      data: {
        action,
        entityType: "Payment",
        entityId: a.paymentId,
        userId: actorId,
        changes: { sentBy: "system", title: a.title, message: a.message, ...(a.facts ?? {}) } as Prisma.InputJsonValue,
      },
    });
    return true;
  });
}

/** Owners who are active and not admins (admins hear through reportSystemFailure). On a lookup error, every owner. */
async function ownersToTell(ownerIds: string[]): Promise<string[]> {
  if (ownerIds.length === 0) return [];
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, role: true, isActive: true },
    });
    return users.filter((u) => u.isActive && !ADMIN_ROLES.has(String(u.role))).map((u) => u.id);
  } catch (e) {
    console.error("[PAID_WITHOUT_SLOT_OWNER_LOOKUP_ERROR]", e);
    return ownerIds;
  }
}

/** Alert the owner(s) and admins, once per payment and kind. true when this call sent it. Never throws. */
export async function alertPaidWithoutSlot(a: PaidWithoutSlotAlert): Promise<boolean> {
  try {
    const owners = [...new Set(a.ownerIds.filter((id): id is string => !!id))];
    if (owners.length > 0) {
      let first = true;
      try {
        first = await claimAlert(a, owners[0]);
      } catch (e) {
        console.error("[PAID_WITHOUT_SLOT_CLAIM_ERROR]", e);
      }
      if (!first) return false;
    }
    const tell = await ownersToTell(owners);
    await Promise.all([
      reportSystemFailure({ area: "Payments — ACTION NEEDED", title: a.title, detail: a.message, actionUrl: a.actionUrl }),
      ...tell.map((userId) =>
        notifyAwait({
          userId,
          type: "SYSTEM",
          title: a.title,
          message: a.message,
          actionUrl: a.actionUrl,
          metadata: { kind: a.kind, paymentId: a.paymentId },
        })
      ),
    ]);
    return true;
  } catch (e) {
    console.error("[PAID_WITHOUT_SLOT_ALERT_ERROR]", e);
    return false;
  }
}

/** A @db.Date day (UTC midnight) as "2 October 2026". */
function dayLabel(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Is this venue, UTC day and slot free right now? The availability board's
 * rule: active bookings minus lapsed holds, and blackouts. null when it can't
 * be read.
 */
async function slotFreeNow(venueId: string, date: Date | string, timeSlot: string, now: Date): Promise<boolean | null> {
  try {
    const { gte, lt, utcDay } = utcDayRange(new Date(date));
    const [rows, blackouts] = await Promise.all([
      prisma.booking.findMany({
        where: { venueId, date: { gte, lt }, status: { not: "CANCELLED" } },
        select: { id: true, status: true, holdExpiresAt: true, date: true, timeSlot: true },
      }),
      prisma.blackoutDate.findMany({ where: { venueId, date: { gte, lt } }, select: { date: true, timeSlot: true } }),
    ]);
    const dayRows = rows.filter((r) => new Date(r.date).getUTCDate() === utcDay);
    const dayBlackouts = blackouts.filter((x) => new Date(x.date).getUTCDate() === utcDay);
    const lapsedIds = await findLapsedHoldIds(dayRows, now);
    return slotIsFree(timeSlot, withoutLapsedHolds(dayRows, lapsedIds), dayBlackouts);
  } catch (e) {
    console.error("[PAID_WITHOUT_SLOT_SLOT_CHECK_ERROR]", e);
    return null;
  }
}

/**
 * A payment has just completed on an invoice whose booking is CANCELLED. The
 * money stays recorded and the booking stays cancelled: auto-confirm acts on
 * HOLD bookings only, so nothing is confirmed onto a slot someone else may
 * hold. Alert the booking owner and admins once, saying whether the slot is
 * still free.
 *
 * Alert only, never a reinstatement: nothing the lapsed-hold release writes
 * tells its cancellations apart from a person's, so a booking is never put
 * back on HOLD automatically. true when this call sent the alert. Never throws.
 */
export async function alertPaymentOnCancelledBooking(paymentId: string, now: Date = new Date()): Promise<boolean> {
  try {
    const p = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        amount: true,
        status: true,
        receiptNumber: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            booking: {
              select: {
                id: true,
                bookingNumber: true,
                status: true,
                date: true,
                timeSlot: true,
                venueId: true,
                createdById: true,
                venue: { select: { name: true } },
                contact: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    const b = p?.invoice.booking;
    if (!p || p.status !== "COMPLETED" || !b || b.status !== "CANCELLED") return false;

    const free = await slotFreeNow(b.venueId, b.date, b.timeSlot, now);
    const customer = [b.contact?.firstName, b.contact?.lastName].filter(Boolean).join(" ").trim() || "The customer";
    const where = `${b.venue?.name ?? "the venue"}, ${dayLabel(b.date)}, ${slotLabel(b.timeSlot)}`;
    const next =
      free === true
        ? "The slot is still free: re-book the customer (a new booking for that date and slot) or refund the payment."
        : free === false
          ? "The slot is no longer free: offer the customer another date or hall, or refund the payment."
          : "Check whether the slot is still free, then re-book the customer or refund the payment.";

    return await alertPaidWithoutSlot({
      kind: "PAYMENT_ON_CANCELLED_BOOKING",
      paymentId: p.id,
      ownerIds: [b.createdById],
      title: `Payment received on cancelled booking ${b.bookingNumber}`,
      message:
        `${customer} paid ${formatINR(p.amount)}${p.receiptNumber ? ` (receipt ${p.receiptNumber})` : ""} on invoice ${p.invoice.invoiceNumber} ` +
        `for booking ${b.bookingNumber} (${where}) after the booking was cancelled. ` +
        `The payment is recorded; the booking was not confirmed. ${next}`,
      actionUrl: `/bookings/${b.id}`,
      facts: { bookingId: b.id, bookingNumber: b.bookingNumber, invoiceId: p.invoice.id, amount: Number(p.amount), slotFree: free },
    });
  } catch (e) {
    console.error("[PAYMENT_ON_CANCELLED_BOOKING_ALERT_ERROR]", e);
    return false;
  }
}

export interface OneTapSlotTaken {
  quotationId: string;
  quoteNumber: string;
  customerName: string | null;
  /** The advance invoice the customer paid. */
  invoiceId: string;
  venueId: string;
  /** The UTC-midnight day the booking was for. */
  date: Date;
  timeSlot: string;
  /** The quote's creator and the rep who shared the link. */
  ownerIds: readonly (string | null | undefined)[];
}

/**
 * A one-tap quote advance was captured, but the booking could not be created
 * because the slot is taken. Alert the quote's owner and admins for every
 * completed payment on the advance invoice, once per payment; with no completed
 * payment nothing is sent. Returns how many alerts this call sent. Never throws.
 */
export async function alertOneTapPaidSlotTaken(t: OneTapSlotTaken): Promise<number> {
  try {
    const [payments, venue] = await Promise.all([
      prisma.payment.findMany({
        where: { invoiceId: t.invoiceId, status: "COMPLETED" },
        select: { id: true, amount: true, receiptNumber: true, invoice: { select: { invoiceNumber: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.venue.findUnique({ where: { id: t.venueId }, select: { name: true } }),
    ]);
    let sent = 0;
    for (const p of payments) {
      const alerted = await alertPaidWithoutSlot({
        kind: "ONE_TAP_SLOT_TAKEN",
        paymentId: p.id,
        ownerIds: t.ownerIds,
        title: `Paid quote ${t.quoteNumber}: slot taken, no booking created`,
        message:
          `${t.customerName?.trim() || "The customer"} paid ${formatINR(p.amount)}${p.receiptNumber ? ` (receipt ${p.receiptNumber})` : ""} ` +
          `on quote ${t.quoteNumber} for ${venue?.name ?? "the venue"}, ${dayLabel(t.date)}, ${slotLabel(t.timeSlot)}, ` +
          `but that slot was already taken, so no booking was created. The payment is recorded on invoice ${p.invoice.invoiceNumber}. ` +
          `Re-book the customer on another date or hall, or refund the payment.`,
        actionUrl: `/quotations/${t.quotationId}`,
        facts: { quotationId: t.quotationId, quoteNumber: t.quoteNumber, invoiceId: t.invoiceId, amount: Number(p.amount) },
      });
      if (alerted) sent++;
    }
    return sent;
  } catch (e) {
    console.error("[ONE_TAP_SLOT_TAKEN_ALERT_ERROR]", e);
    return 0;
  }
}
