"use server";

// ============================================================
// E-Signature — INTERNAL actions (RBAC gated)
// ------------------------------------------------------------
// Create / list / send / void tokenized signature requests for a
// booking. The public signer-facing actions live in
// signature-public.actions.ts (no auth, token scoped).
// ============================================================

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { serialize, formatINR } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { sendEmail } from "@/lib/email";
import {
  buildSignatureDocumentHtml,
  buildSignatureDocumentTitle,
} from "@/lib/legal/signature-document";
import {
  createSignatureRequestSchema,
  type CreateSignatureRequestInput,
} from "@/schemas/signature.schema";
import { format } from "date-fns";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function buildSignUrl(token: string): string {
  return `${appBaseUrl()}/sign/${token}`;
}

// ------------------------------------------------------------
// Create a frozen signature request for a booking
// ------------------------------------------------------------
export async function createSignatureRequest(
  input: CreateSignatureRequestInput
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "esign:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = createSignatureRequestSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }
    const { bookingId, signerName, signerEmail, signerPhone, expiresInDays } =
      parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        bookingNumber: true,
        eventName: true,
        eventType: true,
        date: true,
        timeSlot: true,
        guestCount: true,
        totalAmount: true,
        specialRequests: true,
        status: true,
        venue: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    });
    if (!booking) {
      return { success: false as const, error: "Booking not found" };
    }

    // Only confirmed / active bookings may be signed — never a HOLD or
    // cancelled slot (the signer would otherwise sign for a slot that
    // was never confirmed).
    if (booking.status !== "CONFIRMED" && booking.status !== "IN_PROGRESS") {
      return {
        success: false as const,
        error:
          "A signature request can only be created for a confirmed booking.",
      };
    }

    const contactName = `${booking.contact.firstName} ${
      booking.contact.lastName ?? ""
    }`.trim();

    const documentTitle = buildSignatureDocumentTitle(booking.bookingNumber);
    const documentBody = buildSignatureDocumentHtml({
      contactName,
      bookingNumber: booking.bookingNumber,
      eventName: booking.eventName,
      eventType: booking.eventType,
      date: format(booking.date, "EEEE, d MMMM yyyy"),
      timeSlot: booking.timeSlot,
      venueName: booking.venue.name,
      guestCount: booking.guestCount,
      totalAmount: formatINR(booking.totalAmount),
      specialRequests: booking.specialRequests,
    });

    const token = randomBytes(24).toString("base64url");
    const expiresAt = new Date(
      Date.now() + (expiresInDays ?? 14) * 24 * 60 * 60 * 1000
    );

    const created = await prisma.signatureRequest.create({
      data: {
        token,
        status: "SENT",
        documentTitle,
        documentBody,
        signerName: signerName ?? contactName ?? null,
        signerEmail: (signerEmail || booking.contact.email) ?? null,
        signerPhone: signerPhone ?? booking.contact.phone ?? null,
        expiresAt,
        sentAt: new Date(),
        bookingId: booking.id,
        createdById: session.user.id as string,
      },
      select: { id: true, token: true },
    });

    logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "SignatureRequest",
      entityId: created.id,
      changes: { bookingId: booking.id, bookingNumber: booking.bookingNumber },
    });

    revalidatePath(`/bookings/${booking.id}`);

    return {
      success: true as const,
      data: {
        id: created.id,
        token: created.token,
        signUrl: buildSignUrl(created.token),
      },
    };
  } catch (error) {
    console.error("[CREATE_SIGNATURE_REQUEST_ERROR]", error);
    return { success: false as const, error: "Failed to create signature request" };
  }
}

// ------------------------------------------------------------
// Internal status list for the booking detail panel
// ------------------------------------------------------------
export async function getSignatureRequestsForBooking(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "esign:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const requests = await prisma.signatureRequest.findMany({
      where: { bookingId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        status: true,
        documentTitle: true,
        signerName: true,
        signerEmail: true,
        signerPhone: true,
        signatureType: true,
        signedAt: true,
        sentAt: true,
        viewedAt: true,
        isLocked: true,
        expiresAt: true,
        declinedReason: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    });

    return {
      success: true as const,
      data: serialize(
        requests.map((r) => ({
          ...r,
          signUrl: buildSignUrl(r.token),
        }))
      ),
    };
  } catch (error) {
    console.error("[GET_SIGNATURE_REQUESTS_ERROR]", error);
    return { success: false as const, error: "Failed to load signature requests" };
  }
}

// ------------------------------------------------------------
// Send / resend the tokenized sign link
// ------------------------------------------------------------
export async function sendSignatureRequest(
  id: string,
  options: { method: "WHATSAPP" | "EMAIL"; to?: string }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "esign:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const request = await prisma.signatureRequest.findUnique({
      where: { id },
      select: {
        id: true,
        token: true,
        status: true,
        isLocked: true,
        signerName: true,
        signerEmail: true,
        signerPhone: true,
        documentTitle: true,
        bookingId: true,
        booking: { select: { bookingNumber: true } },
      },
    });
    if (!request) {
      return { success: false as const, error: "Signature request not found" };
    }
    if (request.isLocked || request.status === "SIGNED") {
      return { success: false as const, error: "This document is already signed and locked." };
    }
    if (request.status === "VOIDED" || request.status === "DECLINED" || request.status === "EXPIRED") {
      return { success: false as const, error: "This signature request is no longer active." };
    }

    const signUrl = buildSignUrl(request.token);
    const greetingName = request.signerName?.split(" ")[0] || "there";

    if (options.method === "WHATSAPP") {
      const to = options.to || request.signerPhone;
      if (!to) {
        return { success: false as const, error: "No phone number on file for WhatsApp delivery." };
      }
      const message = `Hi ${greetingName}, please review and sign your booking confirmation for Veloria Grand (${request.booking.bookingNumber}).\n\nSign here: ${signUrl}`;
      const sent = await sendWhatsApp({ to, message });
      if (!sent.success) {
        return { success: false as const, error: sent.error || "Failed to send WhatsApp message" };
      }
    } else {
      const to = options.to || request.signerEmail;
      if (!to) {
        return { success: false as const, error: "No email address on file for email delivery." };
      }
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b;">
          <h2 style="font-size:18px;font-weight:700;">Please sign your booking confirmation</h2>
          <p style="font-size:14px;color:#52525b;line-height:1.6;">Hi ${greetingName},<br/>Your booking confirmation and Terms &amp; Conditions are ready for your signature.</p>
          <p style="margin:24px 0;"><a href="${signUrl}" style="display:inline-block;padding:12px 28px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Review &amp; Sign</a></p>
          <p style="font-size:12px;color:#a1a1aa;">If the button does not work, copy this link into your browser:<br/>${signUrl}</p>
        </div>`;
      const sent = await sendEmail({
        to,
        subject: `Sign your booking confirmation — ${request.booking.bookingNumber}`,
        html,
      });
      if (!sent.success) {
        return { success: false as const, error: sent.error || "Failed to send email" };
      }
    }

    // Keep status at SENT (re-send keeps SENT; do not regress VIEWED).
    if (request.status === "DRAFT") {
      await prisma.signatureRequest.update({
        where: { id: request.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    } else {
      await prisma.signatureRequest.update({
        where: { id: request.id },
        data: { sentAt: new Date() },
      });
    }

    logActivity({
      userId: session.user.id as string,
      action: "sent",
      entityType: "SignatureRequest",
      entityId: request.id,
      changes: { method: options.method },
    });

    revalidatePath(`/bookings/${request.bookingId}`);

    return { success: true as const, data: { id: request.id, signUrl } };
  } catch (error) {
    console.error("[SEND_SIGNATURE_REQUEST_ERROR]", error);
    return { success: false as const, error: "Failed to send signature request" };
  }
}

// ------------------------------------------------------------
// Void an unsigned signature request
// ------------------------------------------------------------
export async function voidSignatureRequest(id: string, reason?: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "esign:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.signatureRequest.findUnique({
      where: { id },
      select: { id: true, bookingId: true },
    });
    if (!existing) {
      return { success: false as const, error: "Signature request not found" };
    }

    // Atomic status guard: only non-terminal, unsigned requests can be voided.
    // A SIGNED/locked document can never be mutated.
    const result = await prisma.signatureRequest.updateMany({
      where: {
        id,
        isLocked: false,
        status: { in: ["DRAFT", "SENT", "VIEWED"] },
      },
      data: {
        status: "VOIDED",
        declinedReason: reason?.trim() || null,
      },
    });

    if (result.count === 0) {
      return {
        success: false as const,
        error: "This request can no longer be voided (already signed, declined or voided).",
      };
    }

    logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "SignatureRequest",
      entityId: id,
      changes: { status: "VOIDED", reason: reason ?? null },
    });

    revalidatePath(`/bookings/${existing.bookingId}`);

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[VOID_SIGNATURE_REQUEST_ERROR]", error);
    return { success: false as const, error: "Failed to void signature request" };
  }
}
