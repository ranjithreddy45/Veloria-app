import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// ============================================================
// Notify the CUSTOMER side of a booking: every login linked to the contact
// (CustomerLink) plus every ACTIVE co-host of the booking (BookingCollaborator).
// Creates in-app notifications (notify() also mirrors to web push when the
// user has subscribed). Never throws; returns how many logins were notified.
// WhatsApp delivery via approved templates is layered on in the
// notifications work — keep this signature stable.
// ============================================================

export interface CustomerNotice {
  contactId: string;
  bookingId?: string | null;
  type?: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
}

export async function notifyCustomer(n: CustomerNotice): Promise<number> {
  try {
    const [links, collaborators] = await Promise.all([
      prisma.customerLink.findMany({ where: { contactId: n.contactId }, select: { userId: true } }),
      n.bookingId
        ? prisma.bookingCollaborator.findMany({
            where: { bookingId: n.bookingId, status: "ACTIVE", userId: { not: null } },
            select: { userId: true },
          })
        : Promise.resolve([] as { userId: string | null }[]),
    ]);
    const userIds = [...new Set([...links.map((l) => l.userId), ...collaborators.map((c) => c.userId)])].filter(
      (id): id is string => Boolean(id)
    );
    for (const userId of userIds) {
      notify({
        userId,
        type: n.type ?? "BOOKING_UPDATED",
        title: n.title,
        message: n.message,
        actionUrl: n.actionUrl ?? undefined,
        metadata: { audience: "CUSTOMER", ...(n.bookingId ? { bookingId: n.bookingId } : {}) },
      });
    }
    return userIds.length;
  } catch (err) {
    console.error("[CUSTOMER_NOTIFY]", err);
    return 0;
  }
}
