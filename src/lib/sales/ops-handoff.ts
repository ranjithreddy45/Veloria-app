import { prisma } from "@/lib/prisma";

/**
 * Ops auto-task population from SOPs.
 * When a booking is confirmed, stamp out a full ExecutionPlan for it from the
 * best-matching SOP template — copying every phase and its task definitions
 * into live ExecutionPhases + ExecutionTasks. The ops team then works the
 * generated checklist on the existing /bookings/[id]/execution dashboard.
 *
 * Idempotent (no-op if a plan already exists) and never throws — safe to call
 * from the payment-confirm path (which has no user session).
 */
export async function instantiateExecutionPlanFromSOP(
  bookingId: string,
  createdById: string,
  eventType?: string | null
): Promise<void> {
  try {
    const existing = await prisma.executionPlan.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    if (existing) return;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { date: true, eventType: true },
    });
    if (!booking) return;

    const withPhases = {
      phases: {
        orderBy: { order: "asc" as const },
        include: { taskDefinitions: { orderBy: { order: "asc" as const } } },
      },
    };

    // Prefer a template for this event type, then the org default, then any active one.
    const evt = eventType || booking.eventType || undefined;
    const template =
      (evt
        ? await prisma.sOPTemplate.findFirst({
            where: { isActive: true, eventType: evt },
            include: withPhases,
          })
        : null) ??
      (await prisma.sOPTemplate.findFirst({
        where: { isActive: true, isDefault: true },
        include: withPhases,
      })) ??
      (await prisma.sOPTemplate.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        include: withPhases,
      }));

    if (!template || template.phases.length === 0) return;

    const plan = await prisma.executionPlan.create({
      data: {
        bookingId,
        sopTemplateId: template.id,
        eventDate: booking.date,
        status: "PLANNING",
        createdById,
      },
      select: { id: true },
    });

    for (const ph of template.phases) {
      const phase = await prisma.executionPhase.create({
        data: { planId: plan.id, name: ph.name, phase: ph.phase, order: ph.order },
        select: { id: true },
      });
      if (ph.taskDefinitions.length) {
        await prisma.executionTask.createMany({
          data: ph.taskDefinitions.map((t) => ({
            phaseId: phase.id,
            title: t.title,
            description: t.description,
            category: t.category,
            priority: t.priority,
            estimatedMinutes: t.estimatedMinutes,
            isMandatory: t.isMandatory,
            requiresApproval: t.requiresApproval,
            requiresProof: t.requiresProof,
            order: t.order,
          })),
        });
      }
    }
  } catch (e) {
    console.error("[OPS_HANDOFF_ERROR]", e);
  }
}
