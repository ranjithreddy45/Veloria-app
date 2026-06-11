import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { processEmailForTracking } from "@/lib/email-tracking";

// ============================================================
// Cadence Executor — Cron-triggered step processor
// ============================================================
// This is a plain library file (NOT "use server").
// Called from the cron API route with no auth check.

interface StepConfig {
  subject?: string;
  body?: string;
  templateId?: string;
  title?: string;
  description?: string;
  priority?: string;
  dueDays?: number;
  message?: string;
  content?: string;
}

/**
 * Resolve the contactId for a given entityId.
 * If entityType is CONTACT, entityId IS the contactId.
 * If entityType is LEAD, look up the lead's contactId.
 */
async function resolveContactId(
  entityId: string,
  entityType: string
): Promise<string | null> {
  if (entityType === "CONTACT") {
    return entityId;
  }

  // entityType === "LEAD"
  const lead = await prisma.lead.findUnique({
    where: { id: entityId },
    select: { contactId: true },
  });
  return lead?.contactId ?? null;
}

export async function processDueCadenceSteps(): Promise<{
  processed: number;
  errors: number;
}> {
  const now = new Date();
  let processed = 0;
  let errors = 0;

  // 1. Find all ACTIVE enrollments where nextExecuteAt <= now
  const dueEnrollments = await prisma.cadenceEnrollment.findMany({
    where: {
      status: "ACTIVE",
      nextExecuteAt: { lte: now },
    },
    include: {
      cadence: {
        include: {
          steps: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  for (const enrollment of dueEnrollments) {
    try {
      const { cadence } = enrollment;

      // 2. Load the current step by currentStepOrder
      const currentStep = cadence.steps.find(
        (s) => s.order === enrollment.currentStepOrder
      );

      if (!currentStep) {
        // No more steps — mark as completed
        await prisma.cadenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            nextExecuteAt: null,
          },
        });
        continue;
      }

      const config = currentStep.config as unknown as StepConfig;
      const contactId = await resolveContactId(enrollment.entityId, cadence.entityType);

      // 3. Execute the step based on stepType
      // Look up contact details for sending emails/WhatsApp
      const contact = contactId
        ? await prisma.contact.findUnique({
            where: { id: contactId },
            select: { email: true, phone: true },
          })
        : null;

      switch (currentStep.stepType) {
        case "SEND_EMAIL": {
          if (contactId) {
            const rawHtml = config.body ?? config.content ?? "";
            const comm = await prisma.communication.create({
              data: {
                type: "EMAIL",
                direction: "OUTBOUND",
                subject: config.subject ?? "Cadence Email",
                content: rawHtml,
                contactId,
                createdById: enrollment.enrolledById,
              },
            });

            // Inject open/click tracking so Email Insights counts automated
            // follow-ups too (previously these sends were invisible).
            let html = rawHtml;
            if (contact?.email) {
              try {
                const { trackedHtml } = await processEmailForTracking(
                  comm.id,
                  contactId,
                  contact.email,
                  rawHtml
                );
                html = trackedHtml;
                await prisma.communication.update({
                  where: { id: comm.id },
                  data: { content: trackedHtml },
                });
              } catch (err) {
                console.error("[CADENCE_EMAIL_TRACKING_ERROR]", err);
              }

              // Fire-and-forget: send the actual (tracked) email
              sendEmail({
                to: contact.email,
                subject: config.subject ?? "Update from Veloria Grand",
                html,
              }).catch((err) => console.error("[CADENCE_EMAIL_ERROR]", err));
            }
          }
          break;
        }

        case "CREATE_TASK": {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (config.dueDays ?? 1));

          await prisma.task.create({
            data: {
              title: config.title ?? "Cadence Task",
              description: config.description ?? null,
              priority: (config.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") ?? "MEDIUM",
              dueDate,
              creatorId: enrollment.enrolledById,
              assigneeId: enrollment.enrolledById,
            },
          });
          break;
        }

        case "SEND_WHATSAPP": {
          if (contactId) {
            await prisma.whatsAppMessage.create({
              data: {
                direction: "OUTBOUND",
                content: config.message ?? "",
                contactId,
                status: "SENT",
              },
            });

            // Fire-and-forget: send the actual WhatsApp message
            if (contact?.phone) {
              sendWhatsApp({
                to: contact.phone,
                message: config.message ?? config.content ?? "",
                template: config.templateId,
              }).catch((err) => console.error("[CADENCE_WHATSAPP_ERROR]", err));
            }
          }
          break;
        }

        case "WAIT": {
          // Wait step — the delay is handled by nextExecuteAt calculation.
          // Just advance to the next step.
          break;
        }

        case "LOG_NOTE": {
          if (contactId) {
            await prisma.communication.create({
              data: {
                type: "NOTE",
                direction: "OUTBOUND",
                content: config.content ?? "Cadence note",
                contactId,
                createdById: enrollment.enrolledById,
              },
            });
          }
          break;
        }

        default:
          break;
      }

      // 4. Create CadenceEnrollmentStep record as EXECUTED
      await prisma.cadenceEnrollmentStep.create({
        data: {
          enrollmentId: enrollment.id,
          stepId: currentStep.id,
          status: "EXECUTED",
          executedAt: now,
        },
      });

      // 5. Advance currentStepOrder and calculate nextExecuteAt from next step's delay
      const nextStepOrder = enrollment.currentStepOrder + 1;
      const nextStep = cadence.steps.find((s) => s.order === nextStepOrder);

      if (nextStep) {
        const nextExecuteAt = new Date();
        nextExecuteAt.setDate(nextExecuteAt.getDate() + nextStep.delayDays);
        nextExecuteAt.setHours(nextExecuteAt.getHours() + nextStep.delayHours);

        await prisma.cadenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStepOrder: nextStepOrder,
            nextExecuteAt,
          },
        });
      } else {
        // 6. No more steps — set enrollment status to COMPLETED
        await prisma.cadenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: "COMPLETED",
            completedAt: now,
            nextExecuteAt: null,
            currentStepOrder: nextStepOrder,
          },
        });
      }

      processed++;

      logActivity({
        userId: "system",
        action: "EXECUTE_CADENCE_STEP",
        entityType: "cadence_enrollment",
        entityId: enrollment.id,
        changes: {
          stepId: currentStep.id,
          stepType: currentStep.stepType,
          order: currentStep.order,
        },
      });
    } catch (error) {
      console.error(
        `[CADENCE_EXECUTOR] Error processing enrollment ${enrollment.id}:`,
        error
      );
      errors++;

      // Record the error in enrollment step
      const currentStep = enrollment.cadence.steps.find(
        (s) => s.order === enrollment.currentStepOrder
      );
      if (currentStep) {
        try {
          await prisma.cadenceEnrollmentStep.create({
            data: {
              enrollmentId: enrollment.id,
              stepId: currentStep.id,
              status: "FAILED",
              error: error instanceof Error ? error.message : "Unknown error",
            },
          });
        } catch {
          // Ignore — error logging itself should not throw
        }
      }
    }
  }

  return { processed, errors };
}
