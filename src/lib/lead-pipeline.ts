// ============================================================
// Lead intake pipeline — the single funnel every captured/created
// lead flows through. Wires: instant auto-reply (via LEAD_CREATED
// workflows), auto-enrollment into nurture cadences, the speed-to-lead
// SLA clock, and the breach/exit/overdue sweeps the cron drives.
//
// Plain library (NOT "use server"): callable from server actions,
// API routes, and cron handlers alike.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { triggerWorkflows } from "@/lib/workflow-executor";
import { checkExitCriteria } from "@/lib/cadence-exit-checker";

// First-response SLA target. Event sales live or die on minutes, not hours.
export const LEAD_SLA_MINUTES = 15;

/** Deadline by which a new lead must get its first human response. */
export function leadSlaDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + LEAD_SLA_MINUTES * 60 * 1000);
}

/** First active SUPER_ADMIN/ADMIN — used as the system actor for automated rows. */
async function getSystemUserId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  return admin?.id || "";
}

// ------------------------------------------------------------
// Auto-enrollment into nurture cadences (wires the dead autoEnroll flag)
// ------------------------------------------------------------

type LeadLike = {
  id: string;
  contactId: string;
  source?: string | null;
  eventType?: string | null;
  status?: string | null;
  guestCount?: number | null;
  score?: number | null;
  estimatedValue?: number | string | null;
};

interface AutoEnrollCriterion {
  field: string;
  operator: string; // equals | not_equals | contains | in | gt | gte | lt | lte
  value: unknown;
}

function fieldValue(lead: LeadLike, field: string): unknown {
  switch (field) {
    case "source":
      return lead.source ?? "";
    case "eventType":
      return lead.eventType ?? "";
    case "status":
      return lead.status ?? "";
    case "guestCount":
      return lead.guestCount ?? 0;
    case "score":
      return lead.score ?? 0;
    case "estimatedValue":
      return lead.estimatedValue != null ? Number(lead.estimatedValue) : 0;
    default:
      return undefined;
  }
}

function matchOne(lead: LeadLike, c: AutoEnrollCriterion): boolean {
  const actual = fieldValue(lead, c.field);
  if (actual === undefined) return false;
  const expected = c.value;
  switch (c.operator) {
    case "equals":
      return String(actual) === String(expected);
    case "not_equals":
      return String(actual) !== String(expected);
    case "contains":
      return String(actual).toLowerCase().includes(String(expected).toLowerCase());
    case "in":
      return Array.isArray(expected)
        ? expected.map(String).includes(String(actual))
        : String(expected).split(",").map((s) => s.trim()).includes(String(actual));
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    default:
      return false;
  }
}

/** Empty/missing criteria = match every lead (autoEnroll means "everyone"). */
function leadMatchesCriteria(lead: LeadLike, criteria: unknown): boolean {
  if (!Array.isArray(criteria) || criteria.length === 0) return true;
  return (criteria as AutoEnrollCriterion[]).every((c) => matchOne(lead, c));
}

/**
 * Enrol a lead into every ACTIVE, autoEnroll cadence whose criteria it matches.
 * Idempotent: the unique (cadenceId, entityId) guard skips re-enrollment.
 */
export async function autoEnrollLeadIntoCadences(lead: LeadLike): Promise<number> {
  let enrolled = 0;
  try {
    const cadences = await prisma.cadence.findMany({
      where: { status: "ACTIVE", autoEnroll: true, entityType: "LEAD" },
      include: { steps: { orderBy: { order: "asc" }, take: 1 } },
    });
    if (cadences.length === 0) return 0;

    const systemId = await getSystemUserId();

    for (const cadence of cadences) {
      if (!leadMatchesCriteria(lead, cadence.autoEnrollCriteria)) continue;

      const existing = await prisma.cadenceEnrollment.findUnique({
        where: { cadenceId_entityId: { cadenceId: cadence.id, entityId: lead.id } },
        select: { id: true },
      });
      if (existing) continue;

      const firstStep = cadence.steps[0];
      const nextExecuteAt = firstStep
        ? new Date(
            Date.now() +
              (firstStep.delayDays ?? 0) * 24 * 60 * 60 * 1000 +
              (firstStep.delayHours ?? 0) * 60 * 60 * 1000
          )
        : null;

      await prisma.cadenceEnrollment.create({
        data: {
          cadenceId: cadence.id,
          entityId: lead.id,
          enrolledById: systemId,
          status: "ACTIVE",
          currentStepOrder: 0,
          nextExecuteAt,
        },
      });
      enrolled++;
      logActivity({
        action: "AUTO_ENROLL_CADENCE",
        entityType: "cadence_enrollment",
        entityId: cadence.id,
        changes: { cadenceId: cadence.id, leadId: lead.id },
        userId: "system",
      });
    }
  } catch (e) {
    console.error("[autoEnrollLeadIntoCadences] error:", e);
  }
  return enrolled;
}

// ------------------------------------------------------------
// Intake — the single post-create entry point
// ------------------------------------------------------------

/**
 * Run the full intake for a freshly created lead: fire LEAD_CREATED
 * workflows (instant email ack + "call now" task) and auto-enrol into
 * nurture cadences. SLA `firstContactDue` is set at row-create time.
 */
export async function runLeadIntake(args: {
  lead: LeadLike;
  triggeredByUserId?: string;
}): Promise<void> {
  const { lead, triggeredByUserId } = args;
  try {
    await triggerWorkflows("LEAD_CREATED", {
      leadId: lead.id,
      contactId: lead.contactId,
      triggeredByUserId: triggeredByUserId ?? (await getSystemUserId()),
    });
  } catch (e) {
    console.error("[runLeadIntake] workflows error:", e);
  }
  await autoEnrollLeadIntoCadences(lead);
}

// ------------------------------------------------------------
// SLA clock — stop it when a rep first responds
// ------------------------------------------------------------

/**
 * Mark first response on any of a contact's still-open leads. Call this
 * whenever an OUTBOUND communication / call is logged, or the lead is
 * advanced off NEW. Stops the SLA clock so it won't escalate.
 */
export async function stampLeadResponded(contactId: string): Promise<void> {
  try {
    await prisma.lead.updateMany({
      where: {
        contactId,
        firstRespondedAt: null,
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
      },
      data: { firstRespondedAt: new Date() },
    });
  } catch (e) {
    console.error("[stampLeadResponded] error:", e);
  }
}

// ------------------------------------------------------------
// Cron sweeps
// ------------------------------------------------------------

/** Escalate leads whose first-response SLA has breached (alert once). */
export async function escalateLeadSlaBreaches(): Promise<number> {
  const now = new Date();
  let escalated = 0;
  try {
    const breached = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { in: ["NEW", "CONTACTED"] },
        firstRespondedAt: null,
        slaEscalatedAt: null,
        firstContactDue: { not: null, lt: now },
      },
      select: {
        id: true,
        title: true,
        assignedToId: true,
        contact: { select: { firstName: true, lastName: true } },
      },
      take: 200,
    });
    if (breached.length === 0) return 0;

    const managers = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
      select: { id: true },
    });

    for (const lead of breached) {
      const who = `${lead.contact?.firstName ?? ""} ${lead.contact?.lastName ?? ""}`.trim() || "a new lead";
      const recipients = new Set<string>();
      if (lead.assignedToId) recipients.add(lead.assignedToId);
      managers.forEach((m) => recipients.add(m.id));

      for (const userId of recipients) {
        notify({
          userId,
          title: "⏰ Lead SLA breached",
          message: `No first response yet for ${who}. Contact them now.`,
          type: "SLA_WARNING",
          actionUrl: `/leads/${lead.id}`,
        });
      }
      await prisma.lead.update({
        where: { id: lead.id },
        data: { slaEscalatedAt: now },
      });
      escalated++;
    }
  } catch (e) {
    console.error("[escalateLeadSlaBreaches] error:", e);
  }
  return escalated;
}

/** Escalate overdue follow-up tasks to their assignee (alert once). */
export async function escalateOverdueTasks(): Promise<number> {
  const now = new Date();
  let escalated = 0;
  try {
    const overdue = await prisma.task.findMany({
      where: {
        status: { in: ["TODO", "IN_PROGRESS"] },
        escalatedAt: null,
        dueDate: { not: null, lt: now },
      },
      select: { id: true, title: true, assigneeId: true },
      take: 200,
    });
    for (const task of overdue) {
      if (task.assigneeId) {
        notify({
          userId: task.assigneeId,
          title: "⏰ Overdue follow-up",
          message: `"${task.title}" is past due. Action it now.`,
          type: "TASK_OVERDUE",
          actionUrl: `/tasks/${task.id}`,
        });
      }
      await prisma.task.update({
        where: { id: task.id },
        data: { escalatedAt: now },
      });
      escalated++;
    }
  } catch (e) {
    console.error("[escalateOverdueTasks] error:", e);
  }
  return escalated;
}

/**
 * A prospect replied (inbound message/comm). Immediately re-check exit
 * criteria for every cadence this contact is enrolled in (as a CONTACT or
 * via any of their leads) so follow-ups stop the moment they engage.
 */
export async function handleInboundReply(contactId: string): Promise<void> {
  try {
    const leads = await prisma.lead.findMany({
      where: { contactId },
      select: { id: true },
    });
    // Contact-entity enrollments + each lead-entity enrollment.
    await checkExitCriteria(contactId, "CONTACT");
    for (const lead of leads) {
      await checkExitCriteria(lead.id, "LEAD");
    }
  } catch (e) {
    console.error("[handleInboundReply] error:", e);
  }
}

/**
 * Sweep every ACTIVE enrollment and exit those whose cadence exit-criteria
 * are met (prospect replied / status changed). Wires the orphaned exit checker.
 */
export async function processCadenceExits(): Promise<number> {
  let exited = 0;
  try {
    const active = await prisma.cadenceEnrollment.findMany({
      where: { status: "ACTIVE" },
      select: { entityId: true, cadence: { select: { entityType: true } } },
      take: 1000,
    });
    // Dedupe by entity so we check each one once.
    const seen = new Set<string>();
    for (const e of active) {
      const key = `${e.cadence.entityType}:${e.entityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ids = await checkExitCriteria(e.entityId, e.cadence.entityType);
      exited += ids.length;
    }
  } catch (e) {
    console.error("[processCadenceExits] error:", e);
  }
  return exited;
}
