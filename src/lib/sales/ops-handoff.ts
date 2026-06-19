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
            where: { isActive: true, eventType: { equals: evt, mode: "insensitive" } },
            // Deterministic when several templates share an event type.
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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

    // All-or-nothing: a mid-loop failure must not leave a half-populated plan
    // (the bookingId-unique plan row would then block any retry). One
    // transaction means a failure rolls the whole plan back cleanly.
    await prisma.$transaction(async (tx) => {
      const plan = await tx.executionPlan.create({
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
        const phase = await tx.executionPhase.create({
          data: { planId: plan.id, name: ph.name, phase: ph.phase, order: ph.order },
          select: { id: true },
        });
        // Create tasks individually so we can resolve dependsOnTaskOrder → id and
        // copy each task's checklistItems — mirroring the manual applySOPToBooking
        // path so the two never drift (previously these were silently dropped).
        const taskOrderToId: Record<number, string> = {};
        for (const t of ph.taskDefinitions) {
          const task = await tx.executionTask.create({
            data: {
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
              dependsOnTaskId:
                t.dependsOnTaskOrder != null ? (taskOrderToId[t.dependsOnTaskOrder] ?? null) : null,
            },
            select: { id: true },
          });
          taskOrderToId[t.order] = task.id;
          if (t.checklistItems) {
            const items = t.checklistItems as Array<{ title: string; order: number }>;
            if (Array.isArray(items) && items.length > 0) {
              await tx.executionChecklist.createMany({
                data: items.map((it) => ({ taskId: task.id, title: it.title, order: it.order })),
              });
            }
          }
        }
      }
    });
  } catch (e) {
    console.error("[OPS_HANDOFF_ERROR]", e);
  }
}
