import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Cadence Exit Criteria Checker
// ============================================================
// Checks if any active enrollments should be exited based on
// the cadence's exit criteria (STATUS_CHANGE, REPLY_RECEIVED).

interface ExitCriterion {
  type: "STATUS_CHANGE" | "REPLY_RECEIVED";
  values: string[];
}

export async function checkExitCriteria(
  entityId: string,
  entityType: string
): Promise<string[]> {
  const exitedIds: string[] = [];

  try {
    // 1. Find all ACTIVE enrollments for the entity
    const activeEnrollments = await prisma.cadenceEnrollment.findMany({
      where: {
        entityId,
        status: "ACTIVE",
      },
      include: {
        cadence: true,
      },
    });

    for (const enrollment of activeEnrollments) {
      const exitCriteria = enrollment.cadence.exitCriteria as unknown as ExitCriterion[];

      if (!Array.isArray(exitCriteria) || exitCriteria.length === 0) {
        continue;
      }

      let shouldExit = false;
      let exitReason = "";

      for (const criterion of exitCriteria) {
        switch (criterion.type) {
          case "STATUS_CHANGE": {
            // Check if the entity's current status is in the criteria's values array
            if (entityType === "LEAD") {
              const lead = await prisma.lead.findUnique({
                where: { id: entityId },
                select: { status: true },
              });
              if (lead && criterion.values.includes(lead.status)) {
                shouldExit = true;
                exitReason = `Lead status changed to ${lead.status}`;
              }
            } else if (entityType === "CONTACT") {
              // Contacts do not have a status field in this schema,
              // but we check isActive as a proxy
              const contact = await prisma.contact.findUnique({
                where: { id: entityId },
                select: { isActive: true },
              });
              if (contact && criterion.values.includes(contact.isActive ? "ACTIVE" : "INACTIVE")) {
                shouldExit = true;
                exitReason = `Contact status: ${contact.isActive ? "ACTIVE" : "INACTIVE"}`;
              }
            }
            break;
          }

          case "REPLY_RECEIVED": {
            // Check for recent INBOUND Communications for the contact
            let contactId: string | null = null;

            if (entityType === "CONTACT") {
              contactId = entityId;
            } else if (entityType === "LEAD") {
              const lead = await prisma.lead.findUnique({
                where: { id: entityId },
                select: { contactId: true },
              });
              contactId = lead?.contactId ?? null;
            }

            if (contactId) {
              // A reply can land as a logged Communication OR an inbound
              // WhatsApp message — count both so cadences stop on either.
              const [recentInbound, recentWhatsApp] = await Promise.all([
                prisma.communication.findFirst({
                  where: {
                    contactId,
                    direction: "INBOUND",
                    createdAt: { gte: enrollment.createdAt },
                  },
                  select: { id: true },
                }),
                prisma.whatsAppMessage.findFirst({
                  where: {
                    contactId,
                    direction: "INBOUND",
                    sentAt: { gte: enrollment.createdAt },
                  },
                  select: { id: true },
                }),
              ]);

              if (recentInbound || recentWhatsApp) {
                shouldExit = true;
                exitReason = "Reply received from contact";
              }
            }
            break;
          }

          default:
            break;
        }

        if (shouldExit) break;
      }

      // 4. If criteria met, update enrollment status to EXITED with exitReason
      if (shouldExit) {
        await prisma.cadenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "EXITED",
            exitReason,
            completedAt: new Date(),
            nextExecuteAt: null,
          },
        });

        exitedIds.push(enrollment.id);

        logActivity({
          userId: "system",
          action: "CADENCE_EXIT_CRITERIA_MET",
          entityType: "cadence_enrollment",
          entityId: enrollment.id,
          changes: {
            exitReason,
            cadenceId: enrollment.cadenceId,
            entityId,
          },
        });
      }
    }
  } catch (error) {
    console.error("[CADENCE_EXIT_CHECKER] Error:", error);
  }

  return exitedIds;
}
