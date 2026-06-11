"use server";

import { auth } from "@/../auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";
import {
  logCommunicationSchema,
  type LogCommunicationInput,
} from "@/schemas/communication.schema";
import { processEmailForTracking } from "@/lib/email-tracking";
import { stampLeadResponded } from "@/lib/lead-pipeline";

// ============================================================
// Get Communications (for a Contact or Booking)
// ============================================================

export async function getCommunications(params: {
  contactId?: string;
  bookingId?: string;
  type?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params.contactId) {
      where.contactId = params.contactId;
    }

    if (params.bookingId) {
      where.bookingId = params.bookingId;
    }

    if (params.type) {
      where.type = params.type;
    }

    const communications = await prisma.communication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return { success: true as const, data: serialize(communications) };
  } catch (error) {
    console.error("[GET_COMMUNICATIONS_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to fetch communications",
    };
  }
}

// ============================================================
// Log Communication (Create New Entry)
// ============================================================

export async function logCommunication(data: LogCommunicationInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = logCommunicationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const commData = parsed.data;

    const communication = await prisma.communication.create({
      data: {
        type: commData.type,
        subject: commData.subject || null,
        content: commData.content,
        direction: commData.direction,
        contactId: commData.contactId,
        bookingId: commData.bookingId || null,
        metadata: (commData.metadata as Prisma.InputJsonValue) ?? undefined,
        createdById: session.user.id,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // A rep reaching out = first response → stop the speed-to-lead SLA clock.
    if (commData.direction === "OUTBOUND" && commData.contactId) {
      await stampLeadResponded(commData.contactId);
    }

    // Email: tracking + actual delivery via Resend for outbound emails
    if (commData.type === "EMAIL" && commData.direction === "OUTBOUND") {
      try {
        // Look up recipient email from contact
        const contact = await prisma.contact.findUnique({
          where: { id: commData.contactId },
          select: { email: true, firstName: true, lastName: true },
        });

        if (contact?.email) {
          const campaignId =
            (commData.metadata as Record<string, unknown>)?.campaignId as
              | string
              | undefined;

          let finalHtml = commData.content;

          // Add tracking pixel
          try {
            const { trackedHtml } = await processEmailForTracking(
              communication.id,
              commData.contactId,
              contact.email,
              commData.content,
              campaignId
            );
            finalHtml = trackedHtml;

            // Update the communication content with tracked HTML
            await prisma.communication.update({
              where: { id: communication.id },
              data: { content: finalHtml },
            });
          } catch (trackingError) {
            console.error("[EMAIL_TRACKING_SETUP_ERROR]", trackingError);
          }

          // Actually deliver the email via Resend
          try {
            const { sendEmail } = await import("@/lib/email");
            const emailResult = await sendEmail({
              to: contact.email,
              subject: commData.subject || `Message from Veloria Grand`,
              html: finalHtml,
            });

            if (emailResult.success) {
              // Store Resend message ID in metadata for tracking
              await prisma.communication.update({
                where: { id: communication.id },
                data: {
                  metadata: {
                    ...(commData.metadata as Record<string, unknown> || {}),
                    emailDelivered: true,
                    resendMessageId: emailResult.messageId,
                    deliveredAt: new Date().toISOString(),
                  },
                },
              });
              console.log("[EMAIL_DELIVERED]", { to: contact.email, messageId: emailResult.messageId });
            } else {
              console.error("[EMAIL_DELIVERY_FAILED]", emailResult.error);
              // Update metadata to record failure
              await prisma.communication.update({
                where: { id: communication.id },
                data: {
                  metadata: {
                    ...(commData.metadata as Record<string, unknown> || {}),
                    emailDelivered: false,
                    deliveryError: emailResult.error,
                  },
                },
              });
            }
          } catch (emailError) {
            console.error("[EMAIL_SEND_ERROR]", emailError);
          }
        }
      } catch (contactError) {
        console.error("[EMAIL_CONTACT_LOOKUP_ERROR]", contactError);
      }
    }

    // Sentiment analysis: fire-and-forget
    try {
      const { analyzeSentiment } = await import("@/lib/ai/sentiment");
      analyzeSentiment(commData.content).then(async (result) => {
        try {
          await prisma.communication.update({
            where: { id: communication.id },
            data: {
              sentiment: result.sentiment,
              sentimentScore: result.score,
              sentimentAt: new Date(),
            },
          });
        } catch (err) {
          console.error("[SENTIMENT_UPDATE_ERROR]", err);
        }
      }).catch((err) => {
        console.error("[SENTIMENT_ANALYSIS_ERROR]", err);
      });
    } catch (err) {
      console.error("[SENTIMENT_IMPORT_ERROR]", err);
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Communication",
      entityId: communication.id,
      changes: {
        type: commData.type,
        direction: commData.direction,
        contactId: commData.contactId,
        bookingId: commData.bookingId || null,
      },
    });

    // Revalidate relevant paths
    if (commData.contactId) {
      revalidatePath(`/contacts/${commData.contactId}`);
    }
    if (commData.bookingId) {
      revalidatePath(`/bookings/${commData.bookingId}`);
    }

    return { success: true as const, data: serialize(communication) };
  } catch (error) {
    console.error("[LOG_COMMUNICATION_ERROR]", error);
    return { success: false as const, error: "Failed to log communication" };
  }
}

// ============================================================
// Delete Communication
// ============================================================

export async function deleteCommunication(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "communications:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const communication = await prisma.communication.findUnique({
      where: { id },
      select: { id: true, contactId: true, bookingId: true },
    });

    if (!communication) {
      return { success: false as const, error: "Communication not found" };
    }

    await prisma.communication.delete({ where: { id } });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "Communication",
      entityId: id,
    });

    // Revalidate relevant paths
    if (communication.contactId) {
      revalidatePath(`/contacts/${communication.contactId}`);
    }
    if (communication.bookingId) {
      revalidatePath(`/bookings/${communication.bookingId}`);
    }

    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_COMMUNICATION_ERROR]", error);
    return {
      success: false as const,
      error: "Failed to delete communication",
    };
  }
}
