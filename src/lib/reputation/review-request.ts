import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";

// ============================================================
// Reputation Flywheel — core helper library (NOT "use server")
// ------------------------------------------------------------
// Auto Google-review request engine. The daily cron idempotently enqueues one
// ReviewRequest per COMPLETED booking (@@unique([bookingId])) and sends a
// WhatsApp review-request carrying an unguessable token link to the PUBLIC
// landing page (/r/<token>). The page gates: rating >= 4 → Google Business URL;
// rating < 4 → private feedback captured for staff.
//
// Best-effort throughout (mirrors the guest-reminder engine): a single failing
// row never aborts the sweep. No money/Decimal handling in this feature.
// ============================================================

// --- Token generation (matches createPortalInvite convention) ---------------
export function generateReviewToken(): string {
  return randomBytes(24).toString("base64url");
}

// --- Gating threshold -------------------------------------------------------
export type GateRoute = "PUBLIC" | "PRIVATE";

export function gateRoute(rating: number): GateRoute {
  return rating >= 4 ? "PUBLIC" : "PRIVATE";
}

// --- Google Business review URL (env-sourced, stamped at enqueue) ------------
// No DB config exists for this; sourced from env so historical requests stay
// stable if the env later changes. Empty string → happy-path degrades to a
// plain thank-you rather than redirecting to a blank URL.
export function getGoogleReviewUrl(): string {
  return process.env.GOOGLE_BUSINESS_REVIEW_URL?.trim() || "";
}

// --- Public landing-page URL builder ----------------------------------------
// Mounted at /r/<token> (NOT /feedback/<token>) so middleware INTERNAL_ROUTES
// (startsWith "/feedback") never gates the guest page behind auth.
export function buildReviewRequestUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  return `${base}/r/${token}`;
}

// --- Worker result shape ----------------------------------------------------
export interface EnqueueResult {
  enqueued: number;
  sent: number;
  failed: number;
  skippedNoPhone: number;
}

const BOOKING_INCLUDE = {
  contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
  venue: { select: { name: true } },
} as const;

// ---------------------------------------------------------------------------
// Send the WhatsApp review request for a single ReviewRequest row and flip its
// status PENDING → SENT (sentAt, whatsappMessageId) or → FAILED (failReason).
// Logs a WhatsAppMessage row both ways. Never throws.
// Returns "sent" | "failed" | "skippedNoPhone".
// ---------------------------------------------------------------------------
async function sendReviewRequest(reviewRequest: {
  id: string;
  token: string;
  contactId: string;
  contact: { firstName: string; lastName: string; phone: string | null };
  booking: { eventName: string };
}): Promise<"sent" | "failed" | "skippedNoPhone"> {
  const { contact } = reviewRequest;
  const phone = contact.phone?.trim();

  if (!phone) {
    await prisma.reviewRequest
      .update({
        where: { id: reviewRequest.id },
        data: { status: "FAILED", failReason: "Contact has no phone number" },
      })
      .catch(() => undefined);
    return "skippedNoPhone";
  }

  const customerName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();
  const reviewLink = buildReviewRequestUrl(reviewRequest.token);
  const eventName = reviewRequest.booking.eventName;

  const textFallback =
    `Hi ${contact.firstName}, thank you for celebrating ${eventName} with Veloria Grand! ` +
    `We'd love to hear how it went — it takes 30 seconds: ${reviewLink}`;

  let result: { success: boolean; messageId?: string; error?: string };
  try {
    // Attempt the approved template first; fall back to text if it fails.
    result = await sendWhatsApp({
      to: phone,
      template: "review_request",
      message: textFallback,
      params: { customerName, eventName, reviewLink },
    });
    if (!result.success) {
      result = await sendWhatsApp({ to: phone, message: textFallback });
    }
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "WhatsApp send threw",
    };
  }

  const messageContent = `[Review request] ${textFallback}`;

  if (!result.success) {
    const reason = result.error || "WhatsApp send failed";
    await prisma.whatsAppMessage
      .create({
        data: {
          direction: "OUTBOUND",
          content: messageContent,
          templateName: "review_request",
          status: "FAILED",
          failureReason: reason,
          contactId: reviewRequest.contactId,
        },
      })
      .catch(() => undefined);

    await prisma.reviewRequest
      .update({
        where: { id: reviewRequest.id },
        data: { status: "FAILED", failReason: reason },
      })
      .catch(() => undefined);
    return "failed";
  }

  await prisma.whatsAppMessage
    .create({
      data: {
        direction: "OUTBOUND",
        content: messageContent,
        templateName: "review_request",
        status: "SENT",
        whatsappId: result.messageId || null,
        contactId: reviewRequest.contactId,
      },
    })
    .catch(() => undefined);

  // Guard the transition: only flip rows still PENDING/FAILED so a concurrent
  // run can't double-advance an already-rated row.
  await prisma.reviewRequest
    .updateMany({
      where: { id: reviewRequest.id, status: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "SENT",
        sentAt: new Date(),
        whatsappMessageId: result.messageId || null,
        failReason: null,
      },
    })
    .catch(() => undefined);

  return "sent";
}

// ---------------------------------------------------------------------------
// Core cron worker. Idempotent + best-effort:
//   1. Enqueue: COMPLETED bookings with no ReviewRequest → create one (PENDING,
//      token, stamped googleReviewUrl, scheduledFor=now). P2002 on
//      @@unique([bookingId]) is treated as already-enqueued.
//   2. Send: any PENDING/FAILED ReviewRequest (new + prior retries) gets a
//      WhatsApp send and a guarded status flip.
// ---------------------------------------------------------------------------
export async function enqueueReviewRequestsForCompletedBookings(): Promise<EnqueueResult> {
  const result: EnqueueResult = {
    enqueued: 0,
    sent: 0,
    failed: 0,
    skippedNoPhone: 0,
  };

  const googleReviewUrl = getGoogleReviewUrl();

  // 1) Enqueue for COMPLETED bookings lacking a ReviewRequest.
  const bookings = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      reviewRequests: { none: {} },
    },
    select: { id: true, contactId: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  for (const booking of bookings) {
    try {
      await prisma.reviewRequest.create({
        data: {
          token: generateReviewToken(),
          status: "PENDING",
          scheduledFor: new Date(),
          googleReviewUrl: googleReviewUrl || null,
          bookingId: booking.id,
          contactId: booking.contactId,
        },
      });
      result.enqueued += 1;
    } catch (error) {
      // P2002 = already enqueued (race / re-run). Anything else: skip the row.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      console.error("[review-request] enqueue failed", booking.id, error);
    }
  }

  // 2) Send (or retry) every PENDING/FAILED request.
  const pending = await prisma.reviewRequest.findMany({
    where: { status: { in: ["PENDING", "FAILED"] } },
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true } },
      booking: { select: { eventName: true } },
    },
    take: 500,
  });

  for (const req of pending) {
    const outcome = await sendReviewRequest({
      id: req.id,
      token: req.token,
      contactId: req.contactId,
      contact: req.contact,
      booking: req.booking,
    });
    if (outcome === "sent") result.sent += 1;
    else if (outcome === "skippedNoPhone") result.skippedNoPhone += 1;
    else result.failed += 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Enqueue + send for a single COMPLETED booking, on demand (manual re-send from
// the staff dashboard). Reuses the idempotent @@unique guard. Returns the
// outcome so the action layer can surface it.
// ---------------------------------------------------------------------------
export async function enqueueReviewRequestForBooking(
  bookingId: string,
): Promise<
  | { ok: true; outcome: "sent" | "failed" | "skippedNoPhone"; alreadyExisted: boolean }
  | { ok: false; error: string }
> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, contactId: true },
  });

  if (!booking) return { ok: false, error: "Booking not found" };
  if (booking.status !== "COMPLETED") {
    return { ok: false, error: "Only completed bookings can be sent a review request" };
  }

  let alreadyExisted = false;
  try {
    await prisma.reviewRequest.create({
      data: {
        token: generateReviewToken(),
        status: "PENDING",
        scheduledFor: new Date(),
        googleReviewUrl: getGoogleReviewUrl() || null,
        bookingId: booking.id,
        contactId: booking.contactId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      alreadyExisted = true;
    } else {
      return { ok: false, error: "Failed to enqueue review request" };
    }
  }

  const req = await prisma.reviewRequest.findUnique({
    where: { bookingId: booking.id },
    include: {
      contact: { select: { firstName: true, lastName: true, phone: true } },
      booking: { select: { eventName: true } },
    },
  });
  if (!req) return { ok: false, error: "Review request not found after enqueue" };

  // Only (re)send when it hasn't yet been rated/routed.
  if (req.status !== "PENDING" && req.status !== "FAILED" && req.status !== "SENT") {
    return { ok: true, outcome: "sent", alreadyExisted };
  }

  const outcome = await sendReviewRequest({
    id: req.id,
    token: req.token,
    contactId: req.contactId,
    contact: req.contact,
    booking: req.booking,
  });

  return { ok: true, outcome, alreadyExisted };
}

export { BOOKING_INCLUDE };
