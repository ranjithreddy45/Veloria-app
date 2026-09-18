"use server";

// ============================================================
// STAFF guest invitations: the team's Guest Manager (/bookings/[id]/guests).
//
// These write the same GuestInvitation rows as the host portal and the guest
// app (portal-guest.actions.ts), through the same send module
// (src/lib/guests/invitation-send.ts), so the team, the host and the public
// /rsvp/[token] page never disagree:
//
//  - An invitation is marked SENT (with sentAt) only after WhatsApp accepted
//    the message. A refusal, an error or no answer leaves the row as it was,
//    and the reason goes back to the caller.
//  - An RSVP token is created once and never replaced, so sending or
//    re-sending keeps working any link a host has already shared.
//  - Who may be invited is guest-invites.ts's rule: a usable phone, not yet
//    invited, no reply on record.
//  - A send holds the same short lease as the host path, so a team member and
//    a host can't send one guest two invitations at once.
//  - Only a committed booking (TENTATIVE, CONFIRMED or IN_PROGRESS) sends.
//  - The approved invite template when one is set, else a text message, with
//    the same capped, link-free names.
//
// Staff gate on invitations:send, which a host doesn't hold, so the entry
// points stay separate from portal-guest.actions.ts. Team sends don't count
// against the customer quotas.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
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
  INVITE_BOOKING_SELECT,
  bookingInviteRefusal,
  deliverInvitation,
  inviteChannel,
  sendInBulk,
  tallySendOutcomes,
  type BulkSendOutcome,
  type SendMode,
} from "@/lib/guests/invitation-send";
import { recordConsent } from "@/lib/privacy/consent";
import { recalcGuestListTotals } from "@/lib/guests/totals";
import { CONSENT_TEXT_RSVP } from "@/lib/privacy/consent-text";

// ============================================================
// Team-side pieces around the shared send module
// ============================================================

const INVITE_GUEST_SELECT = {
  id: true,
  name: true,
  phone: true,
  rsvpStatus: true,
  guestList: { select: { bookingId: true, booking: { select: INVITE_BOOKING_SELECT } } },
} as const;

type NotSent = Exclude<BulkSendOutcome, { outcome: "SENT" }>;

/** Why an invitation wasn't sent, in words the team can act on. */
function notSentError(res: NotSent, name: string, mode: SendMode, bookingStatus: string): string {
  if (res.outcome === "FAILED") {
    return mode === "resend"
      ? `WhatsApp didn't accept the invitation for ${name}, so nothing was changed. ${res.error}`
      : `WhatsApp didn't accept the invitation for ${name}, so it is still marked not sent. ${res.error}`;
  }
  if (res.reason === "NOT_FOUND") return "Guest not found";
  if (res.reason === "BOOKING_NOT_ACTIVE") {
    return bookingInviteRefusal(bookingStatus) ?? "Invitations can't be sent for this booking right now.";
  }
  // Team sends aren't held to the customer quotas; kept so every outcome has words.
  if (res.reason === "DAILY_LIMIT") return `${name}'s invitation is over the sending limit. Try again later.`;
  if (res.reason === "NO_PHONE") return `${name} doesn't have a phone number WhatsApp can reach.`;
  if (res.reason === "REPLIED") return `${name} has already replied.`;
  if (res.reason === "IN_PROGRESS") return `${name}'s invitation is already being sent.`;
  return "Invitation already sent";
}

const NOTE_LEFT_OUT =
  "Sent with the approved WhatsApp invite template, which has fixed wording, so your personal note wasn't included.";

/** Every screen that shows this booking's guests: the team's list, the host portal and the guest app. */
function revalidateGuestViews(bookingId: string) {
  revalidatePath(`/bookings/${bookingId}/guests`);
  revalidatePath(`/portal/guests/${bookingId}`);
  revalidatePath("/app/event/guests");
}

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
    const actorId = session.user.id as string;

    // The guest must be on THIS booking's list, so the invitation row carries the right booking.
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, guestList: { bookingId } },
      select: INVITE_GUEST_SELECT,
    });
    if (!guest) {
      return { success: false as const, error: "Guest not found" };
    }

    const res = await deliverInvitation({
      guest,
      booking: guest.guestList.booking,
      channel: await inviteChannel(),
      actorId,
      via: "team",
      mode: "send",
      customMessage,
    });
    if (res.outcome !== "SENT") {
      return {
        success: false as const,
        error: notSentError(res, guest.name, "send", guest.guestList.booking.status),
      };
    }

    notify({
      userId: actorId,
      type: "SYSTEM",
      title: "Invitation Sent",
      message: `Invitation sent to ${guest.name} for ${guest.guestList.booking.eventName}.`,
      actionUrl: `/bookings/${bookingId}/guests`,
    });

    revalidateGuestViews(bookingId);
    const invitation = await prisma.guestInvitation.findUnique({ where: { id: res.invitationId } });
    return {
      success: true as const,
      data: serialize(invitation),
      ...(res.noteLeftOut ? { notice: NOTE_LEFT_OUT } : {}),
    };
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
    const actorId = session.user.id as string;
    const ids = [...new Set(guestIds)];

    const [guests, channel] = await Promise.all([
      prisma.guest.findMany({
        where: { id: { in: ids }, guestList: { bookingId } },
        select: INVITE_GUEST_SELECT,
      }),
      inviteChannel(),
    ]);
    const byId = new Map(guests.map((g) => [g.id, g]));

    // Every guest found is on this one booking's list: refuse up front when the booking can't send.
    const refusal = guests.length > 0 ? bookingInviteRefusal(guests[0].guestList.booking.status) : null;
    if (refusal) return { success: false as const, error: refusal };

    const outcomes = await sendInBulk(
      ids,
      async (id): Promise<BulkSendOutcome> => {
        const guest = byId.get(id);
        if (!guest) return { outcome: "SKIPPED", reason: "NOT_FOUND" };
        return deliverInvitation({
          guest,
          booking: guest.guestList.booking,
          channel,
          actorId,
          via: "team",
          mode: "send",
          customMessage,
        });
      },
      "[BULK_SEND_INVITATION_ERROR]"
    );

    const { counts, reasons, alreadySent, failed, noteLeftOut } = tallySendOutcomes(outcomes);
    const parts = [`${counts.sent} sent`];
    if (counts.alreadyInvited) parts.push(`${counts.alreadyInvited} already invited`);
    if (counts.inProgress) parts.push(`${counts.inProgress} already being sent`);
    if (counts.replied) parts.push(`${counts.replied} already replied`);
    if (counts.needPhone) parts.push(`${counts.needPhone} without a phone number WhatsApp can reach`);
    if (counts.notFound) parts.push(`${counts.notFound} not on this booking's guest list`);
    if (counts.bookingNotActive) {
      parts.push(`${counts.bookingNotActive} not sent because the booking can't send invitations now`);
    }
    if (counts.overLimit) parts.push(`${counts.overLimit} over the sending limit`);
    if (counts.notAccepted) {
      parts.push(`${counts.notAccepted} not accepted by WhatsApp (${reasons.join("; ")})`);
    }
    const message = parts.join(" · ");

    await logActivity({
      userId: actorId,
      action: "bulk_sent_invitations",
      entityType: "GuestInvitation",
      entityId: bookingId,
      changes: { ...counts, total: ids.length },
    });

    notify({
      userId: actorId,
      type: "SYSTEM",
      title: counts.sent > 0 ? "Invitations Sent" : "No Invitations Sent",
      message: `${message} (out of ${ids.length} guests).`,
      actionUrl: `/bookings/${bookingId}/guests`,
    });

    revalidateGuestViews(bookingId);
    return {
      success: true as const,
      data: {
        ...counts,
        // The Guest Manager's summary reads these two; with `sent`, every guest lands in exactly one.
        alreadySent,
        failed,
        message,
        ...(noteLeftOut ? { notice: NOTE_LEFT_OUT } : {}),
      },
    };
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

    if (typeof guestId !== "string" || !guestId) {
      return { success: false as const, error: "Invitation not found" };
    }

    const invitation = await prisma.guestInvitation.findUnique({
      where: { guestId },
      select: { id: true, guest: { select: INVITE_GUEST_SELECT } },
    });

    if (!invitation) {
      return { success: false as const, error: "Invitation not found" };
    }

    const guest = invitation.guest;
    const booking = guest.guestList.booking;

    // Same message, same RSVP link: the token already on the invitation is reused.
    const res = await deliverInvitation({
      guest,
      booking,
      channel: await inviteChannel(),
      actorId: session.user.id as string,
      via: "team",
      mode: "resend",
    });
    if (res.outcome !== "SENT") {
      return { success: false as const, error: notSentError(res, guest.name, "resend", booking.status) };
    }

    notify({
      userId: session.user.id as string,
      type: "SYSTEM",
      title: "Invitation Resent",
      message: `Invitation resent to ${guest.name} for ${booking.eventName}.`,
      actionUrl: `/bookings/${booking.id}/guests`,
    });

    revalidateGuestViews(booking.id);
    const updatedInvitation = await prisma.guestInvitation.findUnique({ where: { id: res.invitationId } });
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

    // No reply message is read: nothing on the invitation or the guest holds one, so the
    // RSVP page no longer offers a note for the hosts (one sent by an old page is ignored).
    const { token, response, plusOnes, dietaryRestrictions, consent, mealVeg, mealNonVeg, mealJain } = parsed.data;

    // DPDP: the guest must agree before we store their response. This is our
    // own hosted page, so the tick is enforced here, not just in the UI.
    if (consent !== true) {
      return {
        success: false as const,
        error: "Please agree to the privacy notice to send your response.",
      };
    }

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

    // Early bail for a clearly-already-responded invitation (cheap UX path;
    // the authoritative guard is the atomic claim below).
    if (invitation.rsvpRespondedAt) {
      return { success: false as const, error: "Already responded" };
    }

    const guest = invitation.guest;
    const booking = guest.guestList.booking;

    // Atomically claim the response: only the first concurrent submission whose
    // rsvpRespondedAt is still null matches the guard and writes. A read-then-
    // write check is TOCTOU on this public/unauthenticated token endpoint
    // (double-click, prefetch, retry) — two writers could both pass and both
    // fire the owner notification / overwrite fields. updateMany guarded on
    // rsvpRespondedAt === null makes the transition happen exactly once.
    const claim = await prisma.guestInvitation.updateMany({
      where: { rsvpToken: token, rsvpRespondedAt: null },
      data: {
        invitationStatus: response === "ACCEPTED" ? "RSVP_ACCEPTED" : "RSVP_DECLINED",
        rsvpRespondedAt: new Date(),
        rsvpResponse: response,
      },
    });

    if (claim.count === 0) {
      return { success: false as const, error: "Already responded" };
    }

    // Update guest RSVP status and optional fields.
    //
    // The meal counts are written as a SET or not at all: the schema has already
    // refused a split that doesn't account for the party, and storing one of the
    // three would leave a total that reads as real but under-counts the party.
    // Declining clears them, so a changed mind can't leave covers behind it.
    const mealAnswered =
      response === "ACCEPTED" && [mealVeg, mealNonVeg, mealJain].some((n) => n != null);
    await prisma.guest.update({
      where: { id: guest.id },
      data: {
        rsvpStatus: response === "ACCEPTED" ? "ACCEPTED" : "DECLINED",
        ...(plusOnes !== undefined && { plusOnes }),
        ...(dietaryRestrictions && { dietaryRestrictions }),
        ...(mealAnswered
          ? { mealVeg: mealVeg ?? 0, mealNonVeg: mealNonVeg ?? 0, mealJain: mealJain ?? 0 }
          : response === "DECLINED"
            ? { mealVeg: null, mealNonVeg: null, mealJain: null }
            : {}),
      },
    });

    // Keep the stored guest-list totals in step. Every other RSVP writer does
    // this; this path did not, so a link RSVP left GuestList.totalRSVP stale —
    // invisible only because the screens recompute from Guest rows on read.
    await recalcGuestListTotals(guest.guestListId);

    // Consent ledger (DPDP). Awaited (one insert) so a serverless freeze
    // can't drop it; the helper never throws.
    await recordConsent({
      subjectType: "GUEST",
      subjectId: guest.id,
      email: guest.email ?? null,
      phone: guest.phone ?? null,
      purpose: "RSVP",
      source: "/rsvp",
      consentText: CONSENT_TEXT_RSVP,
    });

    // Notify the booking creator about the RSVP (fire-and-forget)
    notify({
      userId: booking.createdById,
      type: "SYSTEM",
      title: `RSVP ${response === "ACCEPTED" ? "Accepted" : "Declined"}`,
      message: `${guest.name} has ${response === "ACCEPTED" ? "accepted" : "declined"} the invitation for ${booking.eventName}.`,
      actionUrl: `/bookings/${booking.id}/guests`,
    });

    revalidateGuestViews(booking.id);

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
