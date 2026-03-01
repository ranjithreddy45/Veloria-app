"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { notify } from "@/lib/notify";
import {
  sendInvitationSchema,
  bulkSendInvitationSchema,
  rsvpResponseSchema,
  type SendInvitationInput,
  type BulkSendInvitationInput,
  type RsvpResponseInput,
} from "@/schemas/invitation.schema";
import {
  buildInvitationMessage,
  buildRsvpUrl,
} from "@/lib/invitation-message-builder";
import { scheduleReminders } from "@/lib/reminder-engine";
import { nanoid } from "nanoid";
import { format } from "date-fns";

// ============================================================
// Send Guest Invitation
// ============================================================

export async function sendGuestInvitation(data: SendInvitationInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "invitations:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = sendInvitationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { guestId, bookingId, customMessage } = parsed.data;

    // Fetch guest with full chain: guest -> guestList -> booking (with venue, contact)
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        guestList: {
          include: {
            booking: {
              include: {
                venue: { select: { name: true } },
                contact: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!guest) {
      return { success: false as const, error: "Guest not found" };
    }

    if (!guest.phone) {
      return { success: false as const, error: "Guest does not have a phone number" };
    }

    const booking = guest.guestList.booking;

    // Check if invitation already exists and has been sent
    const existingInvitation = await prisma.guestInvitation.findUnique({
      where: { guestId },
    });

    if (existingInvitation && existingInvitation.invitationStatus !== "NOT_SENT") {
      return { success: false as const, error: "Invitation already sent" };
    }

    // Generate RSVP token and URLs
    const rsvpToken = nanoid(16);
    const rsvpUrl = buildRsvpUrl(rsvpToken);

    // Format event date and time
    const eventDate = format(new Date(booking.date), "EEEE, MMMM d, yyyy");
    const eventTime = booking.startTime
      ? format(new Date(booking.startTime), "h:mm a")
      : undefined;

    // Build invitation message
    const messageContent = buildInvitationMessage({
      guestName: guest.name,
      eventName: booking.eventName,
      eventDate,
      eventTime,
      venueName: booking.venue.name,
      hostName: `${booking.contact.firstName} ${booking.contact.lastName}`,
      rsvpLink: rsvpUrl,
      customMessage: customMessage || undefined,
    });

    // Send WhatsApp message (fire-and-forget)
    sendWhatsApp({
      to: guest.phone,
      template: "guest_invitation",
      message: messageContent,
    }).catch((err) => {
      console.error("[SEND_INVITATION_WHATSAPP_ERROR]", err);
    });

    // Create or update GuestInvitation
    const invitation = await prisma.guestInvitation.upsert({
      where: { guestId },
      create: {
        guestId,
        bookingId,
        rsvpToken,
        invitationStatus: "SENT",
        sentAt: new Date(),
        messageContent,
      },
      update: {
        invitationStatus: "SENT",
        sentAt: new Date(),
        messageContent,
        rsvpToken,
      },
    });

    // Schedule reminders (fire-and-forget)
    scheduleReminders(guest.id, booking.id, booking.date).catch((err) => {
      console.error("[SCHEDULE_REMINDERS_ERROR]", err);
    });

    // Log activity (fire-and-forget)
    logActivity({
      userId: session.user.id as string,
      action: "sent_invitation",
      entityType: "GuestInvitation",
      entityId: invitation.id,
      changes: { guestId, guestName: guest.name, bookingId },
    });

    // Notify (fire-and-forget)
    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Invitation Sent",
      message: `Invitation sent to ${guest.name} for ${booking.eventName}.`,
      actionUrl: `/bookings/${bookingId}/guests`,
    });

    revalidatePath(`/bookings/${bookingId}/guests`);
    return { success: true as const, data: serialize(invitation) };
  } catch (error) {
    console.error("[SEND_GUEST_INVITATION_ERROR]", error);
    return { success: false as const, error: "Failed to send invitation" };
  }
}

// ============================================================
// Bulk Send Invitations
// ============================================================

export async function bulkSendInvitations(data: BulkSendInvitationInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "invitations:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = bulkSendInvitationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { guestIds, bookingId, customMessage } = parsed.data;

    let sent = 0;
    let failed = 0;
    let alreadySent = 0;

    // Process sequentially to avoid race conditions
    for (const guestId of guestIds) {
      const result = await sendGuestInvitation({
        guestId,
        bookingId,
        customMessage,
      });

      if (result.success) {
        sent++;
      } else if (result.error === "Invitation already sent") {
        alreadySent++;
      } else {
        failed++;
      }
    }

    // Log activity (fire-and-forget)
    logActivity({
      userId: session.user.id as string,
      action: "bulk_sent_invitations",
      entityType: "GuestInvitation",
      entityId: bookingId,
      changes: { sent, failed, alreadySent, total: guestIds.length },
    });

    // Notify (fire-and-forget)
    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Bulk Invitations Sent",
      message: `${sent} sent, ${alreadySent} already sent, ${failed} failed out of ${guestIds.length} guests.`,
      actionUrl: `/bookings/${bookingId}/guests`,
    });

    revalidatePath(`/bookings/${bookingId}/guests`);
    return { success: true as const, data: { sent, failed, alreadySent } };
  } catch (error) {
    console.error("[BULK_SEND_INVITATIONS_ERROR]", error);
    return { success: false as const, error: "Failed to send bulk invitations" };
  }
}

// ============================================================
// Get Invitation Status (Summary for a Booking)
// ============================================================

export async function getInvitationStatus(bookingId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "invitations:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Get all guests for this booking via guestList
    const guestList = await prisma.guestList.findUnique({
      where: { bookingId },
      include: {
        guests: {
          select: { id: true },
        },
      },
    });

    if (!guestList) {
      return {
        success: true as const,
        data: {
          totalGuests: 0,
          invited: 0,
          accepted: 0,
          declined: 0,
          pending: 0,
          delivered: 0,
        },
      };
    }

    const totalGuests = guestList.guests.length;
    const guestIds = guestList.guests.map((g) => g.id);

    // Get all invitations for these guests
    const invitations = await prisma.guestInvitation.findMany({
      where: { bookingId },
      select: { guestId: true, invitationStatus: true },
    });

    const invitationMap = new Map(
      invitations.map((inv) => [inv.guestId, inv.invitationStatus])
    );

    let invited = 0;
    let accepted = 0;
    let declined = 0;
    let pending = 0;
    let delivered = 0;

    const INVITED_STATUSES = ["SENT", "DELIVERED", "OPENED", "RSVP_ACCEPTED", "RSVP_DECLINED"];
    const DELIVERED_STATUSES = ["DELIVERED", "OPENED", "RSVP_ACCEPTED", "RSVP_DECLINED"];

    for (const guestId of guestIds) {
      const status = invitationMap.get(guestId);

      if (!status || status === "NOT_SENT") {
        pending++;
      } else {
        if (INVITED_STATUSES.includes(status)) invited++;
        if (DELIVERED_STATUSES.includes(status)) delivered++;
        if (status === "RSVP_ACCEPTED") accepted++;
        if (status === "RSVP_DECLINED") declined++;
      }
    }

    return {
      success: true as const,
      data: {
        totalGuests,
        invited,
        accepted,
        declined,
        pending,
        delivered,
      },
    };
  } catch (error) {
    console.error("[GET_INVITATION_STATUS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch invitation status" };
  }
}

// ============================================================
// Resend Invitation
// ============================================================

export async function resendInvitation(guestId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "invitations:send")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Find existing invitation with guest and booking details
    const invitation = await prisma.guestInvitation.findUnique({
      where: { guestId },
      include: {
        guest: {
          include: {
            guestList: {
              include: {
                booking: {
                  include: {
                    venue: { select: { name: true } },
                    contact: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      return { success: false as const, error: "Invitation not found" };
    }

    const guest = invitation.guest;
    if (!guest.phone) {
      return { success: false as const, error: "Guest does not have a phone number" };
    }

    const booking = guest.guestList.booking;

    // Format event date and time
    const eventDate = format(new Date(booking.date), "EEEE, MMMM d, yyyy");
    const eventTime = booking.startTime
      ? format(new Date(booking.startTime), "h:mm a")
      : undefined;

    // Rebuild message
    const rsvpUrl = buildRsvpUrl(invitation.rsvpToken);
    const messageContent = buildInvitationMessage({
      guestName: guest.name,
      eventName: booking.eventName,
      eventDate,
      eventTime,
      venueName: booking.venue.name,
      hostName: `${booking.contact.firstName} ${booking.contact.lastName}`,
      rsvpLink: rsvpUrl,
    });

    // Resend via WhatsApp (fire-and-forget)
    sendWhatsApp({
      to: guest.phone,
      template: "guest_invitation",
      message: messageContent,
    }).catch((err) => {
      console.error("[RESEND_INVITATION_WHATSAPP_ERROR]", err);
    });

    // Update invitation sentAt
    const updatedInvitation = await prisma.guestInvitation.update({
      where: { guestId },
      data: {
        sentAt: new Date(),
        messageContent,
        invitationStatus: "SENT",
      },
    });

    // Log activity (fire-and-forget)
    logActivity({
      userId: session.user.id as string,
      action: "resent_invitation",
      entityType: "GuestInvitation",
      entityId: updatedInvitation.id,
      changes: { guestId, guestName: guest.name },
    });

    // Notify (fire-and-forget)
    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Invitation Resent",
      message: `Invitation resent to ${guest.name} for ${booking.eventName}.`,
      actionUrl: `/bookings/${booking.id}/guests`,
    });

    revalidatePath(`/bookings/${booking.id}/guests`);
    return { success: true as const, data: serialize(updatedInvitation) };
  } catch (error) {
    console.error("[RESEND_INVITATION_ERROR]", error);
    return { success: false as const, error: "Failed to resend invitation" };
  }
}

// ============================================================
// Process RSVP Response (Public — No Auth Required)
// ============================================================

export async function processRsvpResponse(data: RsvpResponseInput) {
  try {
    const parsed = rsvpResponseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { token, response, plusOnes, dietaryRestrictions, message } = parsed.data;

    // Find GuestInvitation by rsvpToken
    const invitation = await prisma.guestInvitation.findUnique({
      where: { rsvpToken: token },
      include: {
        guest: {
          include: {
            guestList: {
              include: {
                booking: {
                  select: {
                    id: true,
                    eventName: true,
                    createdById: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      return { success: false as const, error: "Invalid RSVP link" };
    }

    // Check if already responded
    if (invitation.rsvpRespondedAt) {
      return { success: false as const, error: "Already responded" };
    }

    const guest = invitation.guest;
    const booking = guest.guestList.booking;

    // Update invitation status
    await prisma.guestInvitation.update({
      where: { rsvpToken: token },
      data: {
        invitationStatus: response === "ACCEPTED" ? "RSVP_ACCEPTED" : "RSVP_DECLINED",
        rsvpRespondedAt: new Date(),
        rsvpResponse: response,
      },
    });

    // Update guest RSVP status and optional fields
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        rsvpStatus: response === "ACCEPTED" ? "ACCEPTED" : "DECLINED",
        ...(plusOnes !== undefined && { plusOnes }),
        ...(dietaryRestrictions && { dietaryRestrictions }),
      },
    });

    // Notify the booking creator about the RSVP (fire-and-forget)
    notify({
      userId: booking.createdById,
      type: "SYSTEM",
      title: `RSVP ${response === "ACCEPTED" ? "Accepted" : "Declined"}`,
      message: `${guest.name} has ${response === "ACCEPTED" ? "accepted" : "declined"} the invitation for ${booking.eventName}.`,
      actionUrl: `/bookings/${booking.id}/guests`,
    });

    revalidatePath(`/bookings/${booking.id}/guests`);

    return {
      success: true as const,
      data: {
        guestName: guest.name,
        eventName: booking.eventName,
        response,
      },
    };
  } catch (error) {
    console.error("[PROCESS_RSVP_RESPONSE_ERROR]", error);
    return { success: false as const, error: "Failed to process RSVP response" };
  }
}
