import { prisma } from "@/lib/prisma";
import { buildOpsAssigner, type OpsAssignment } from "@/lib/sales/ops-assignment";

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
): Promise<OpsAssignment[]> {
  try {
    const existing = await prisma.executionPlan.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    if (existing) return [];

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { date: true, eventType: true },
    });
    if (!booking) return [];

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

    if (!template || template.phases.length === 0) return [];

    // Round-robin assigner over the active ops staff — built once so every task
    // lands on the team that owns its category (decor/AV/catering/…) instead of
    // being left orphaned for someone to triage.
    const assigner = await buildOpsAssigner();

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
              // Auto-route to the team that owns this category (round-robin).
              assigneeId: assigner.assign(t.category),
              dependsOnTaskId:
                t.dependsOnTaskOrder != null ? (taskOrderToId[t.dependsOnTaskOrder] ?? null) : null,
            },
            select: { id: true },
          });
          taskOrderToId[t.order] = task.id;
          if (t.checklistItems) {
            // Be tolerant of whatever shape checklistItems was stored in — a
            // string[], or objects keyed title/text/label/name. A single malformed
            // item must NEVER throw and roll back the WHOLE execution plan (which
            // would silently leave the event with no team tasks at all).
            const raw = Array.isArray(t.checklistItems) ? t.checklistItems : [];
            const items = raw
              .map((it: unknown, idx: number) => {
                const o = (it ?? {}) as Record<string, unknown>;
                const title =
                  typeof it === "string"
                    ? it
                    : (o.title ?? o.text ?? o.label ?? o.name ?? null);
                if (title == null || String(title).trim() === "") return null;
                const order = Number(o.order);
                return { taskId: task.id, title: String(title).slice(0, 500), order: Number.isFinite(order) ? order : idx };
              })
              .filter((x): x is { taskId: string; title: string; order: number } => x !== null);
            if (items.length > 0) {
              await tx.executionChecklist.createMany({ data: items });
            }
          }
        }
      }
    });

    return assigner.summary();
  } catch (e) {
    console.error("[OPS_HANDOFF_ERROR]", e);
    return [];
  }
}
