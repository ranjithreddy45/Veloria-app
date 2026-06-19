"use server";

// ============================================================
// E-Signature — PUBLIC actions (NO auth, token scoped)
// ------------------------------------------------------------
// Mirrors getPublicInvoiceForPayment / processRsvpResponse: resolves
// strictly by an unguessable token, returns ONLY signer-facing data,
// and uses a uniform not-found shape for missing/expired/voided
// tokens to avoid enumeration. Double-signing is made impossible via
// an atomic updateMany status guard.
// ============================================================

import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import {
  submitSignatureSchema,
  declineSignatureSchema,
  type SubmitSignatureInput,
  type DeclineSignatureInput,
} from "@/schemas/signature.schema";

// Uniform "this link isn't valid" result — never leaks whether a token
// exists, is expired, voided, etc.
function invalidLink() {
  return { success: false as const, error: "INVALID_LINK" };
}

async function captureRequestAudit(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    // On Vercel x-forwarded-for is a comma list; take the first hop.
    const ip =
      (xff ? xff.split(",")[0]?.trim() : null) ||
      h.get("x-real-ip") ||
      null;
    const userAgent = h.get("user-agent");
    return { ip: ip || null, userAgent: userAgent || null };
  } catch {
    return { ip: null, userAgent: null };
  }
}

// ------------------------------------------------------------
// Public fetch — returns ONLY signer-facing fields
// ------------------------------------------------------------
export async function getPublicSignatureRequest(token: string) {
  try {
    if (!token) return invalidLink();

    const request = await prisma.signatureRequest.findUnique({
      where: { token },
      select: {
        status: true,
        documentTitle: true,
        documentBody: true,
        signerName: true,
        signedAt: true,
        isLocked: true,
        expiresAt: true,
        booking: { select: { eventName: true, bookingNumber: true } },
      },
    });

    if (!request) return invalidLink();

    // Voided / declined links are dead — present as invalid.
    if (request.status === "VOIDED" || request.status === "DECLINED") {
      return invalidLink();
    }

    // Expired (either marked EXPIRED or past expiresAt) — but still allow
    // viewing an already-SIGNED document as a receipt.
    const isExpired =
      request.status === "EXPIRED" ||
      (request.expiresAt != null &&
        request.expiresAt.getTime() < Date.now() &&
        request.status !== "SIGNED");
    if (isExpired) return invalidLink();

    return {
      success: true as const,
      data: {
        status: request.status,
        documentTitle: request.documentTitle,
        documentBody: request.documentBody,
        signerName: request.signerName,
        signedAt: request.signedAt ? request.signedAt.toISOString() : null,
        isLocked: request.isLocked,
        expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
        eventName: request.booking.eventName,
        bookingNumber: request.booking.bookingNumber,
      },
    };
  } catch (error) {
    console.error("[GET_PUBLIC_SIGNATURE_ERROR]", error);
    return invalidLink();
  }
}

// ------------------------------------------------------------
// Mark viewed — idempotent SENT -> VIEWED
// ------------------------------------------------------------
export async function markSignatureViewed(token: string) {
  try {
    if (!token) return { success: false as const, error: "INVALID_LINK" };
    await prisma.signatureRequest.updateMany({
      where: { token, status: "SENT", isLocked: false },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    return { success: true as const };
  } catch (error) {
    console.error("[MARK_SIGNATURE_VIEWED_ERROR]", error);
    // Non-critical — never surface to signer.
    return { success: true as const };
  }
}

// ------------------------------------------------------------
// Submit signature — atomic, idempotent against double-signing
// ------------------------------------------------------------
export async function submitSignature(input: SubmitSignatureInput) {
  try {
    const parsed = submitSignatureSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const { token, signerName, signatureType, signatureData } = parsed.data;

    // Pre-check existence with the uniform invalid shape (no enumeration).
    const existing = await prisma.signatureRequest.findUnique({
      where: { token },
      select: { id: true, status: true, isLocked: true, expiresAt: true, bookingId: true },
    });
    if (
      !existing ||
      existing.status === "VOIDED" ||
      existing.status === "DECLINED"
    ) {
      return { success: false as const, error: "This link is no longer valid." };
    }
    if (existing.isLocked || existing.status === "SIGNED") {
      return { success: false as const, error: "This document has already been signed." };
    }
    if (
      existing.status === "EXPIRED" ||
      (existing.expiresAt != null && existing.expiresAt.getTime() < Date.now())
    ) {
      return { success: false as const, error: "This signing link has expired." };
    }

    const { ip, userAgent } = await captureRequestAudit();

    // Atomic guard — the ONLY transition into SIGNED. If two requests race,
    // exactly one updates a row; the other sees count===0.
    const result = await prisma.signatureRequest.updateMany({
      where: {
        token,
        isLocked: false,
        status: { in: ["SENT", "VIEWED"] },
      },
      data: {
        status: "SIGNED",
        isLocked: true,
        signedAt: new Date(),
        signerName,
        signatureType,
        signatureData,
        signedIp: ip,
        signedUserAgent: userAgent,
      },
    });

    if (result.count === 0) {
      return {
        success: false as const,
        error: "This document has already been signed or is no longer available.",
      };
    }

    // Best-effort: notify the internal owner + audit log. Never block signing.
    try {
      const signed = await prisma.signatureRequest.findUnique({
        where: { token },
        select: {
          id: true,
          bookingId: true,
          createdById: true,
          booking: { select: { eventName: true, bookingNumber: true } },
        },
      });
      if (signed) {
        notify({
          userId: signed.createdById,
          type: "SYSTEM",
          title: "Booking confirmation signed",
          message: `${signerName} signed the booking confirmation for ${signed.booking.eventName} (${signed.booking.bookingNumber}).`,
          actionUrl: `/bookings/${signed.bookingId}`,
        });
        logActivity({
          userId: signed.createdById,
          action: "status_changed",
          entityType: "SignatureRequest",
          entityId: signed.id,
          changes: { status: "SIGNED", signatureType },
        });
      }
    } catch (notifyErr) {
      console.error("[SIGNATURE_NOTIFY_ERROR]", notifyErr);
    }

    return { success: true as const, data: { signerName } };
  } catch (error) {
    console.error("[SUBMIT_SIGNATURE_ERROR]", error);
    return { success: false as const, error: "Failed to record your signature. Please try again." };
  }
}

// ------------------------------------------------------------
// Decline — SENT/VIEWED -> DECLINED
// ------------------------------------------------------------
export async function declineSignature(input: DeclineSignatureInput) {
  try {
    const parsed = declineSignatureSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: "Validation failed" };
    }
    const { token, reason } = parsed.data;

    const result = await prisma.signatureRequest.updateMany({
      where: {
        token,
        isLocked: false,
        status: { in: ["SENT", "VIEWED"] },
      },
      data: {
        status: "DECLINED",
        declinedReason: reason?.trim() || null,
      },
    });

    if (result.count === 0) {
      return {
        success: false as const,
        error: "This document can no longer be declined.",
      };
    }

    try {
      const declined = await prisma.signatureRequest.findUnique({
        where: { token },
        select: {
          id: true,
          bookingId: true,
          createdById: true,
          booking: { select: { eventName: true, bookingNumber: true } },
        },
      });
      if (declined) {
        notify({
          userId: declined.createdById,
          type: "SYSTEM",
          title: "Booking confirmation declined",
          message: `The signer declined the booking confirmation for ${declined.booking.eventName} (${declined.booking.bookingNumber}).`,
          actionUrl: `/bookings/${declined.bookingId}`,
        });
      }
    } catch (notifyErr) {
      console.error("[SIGNATURE_DECLINE_NOTIFY_ERROR]", notifyErr);
    }

    return { success: true as const };
  } catch (error) {
    console.error("[DECLINE_SIGNATURE_ERROR]", error);
    return { success: false as const, error: "Failed to record your response." };
  }
}
