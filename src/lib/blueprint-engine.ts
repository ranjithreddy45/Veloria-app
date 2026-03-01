import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ============================================================
// Types
// ============================================================

interface TransitionValidationResult {
  allowed: boolean;
  errors: string[];
  transition: {
    id: string;
    name: string | null;
    requiredFields: string[];
    requiredActions: string[];
    allowedRoles: string[];
  } | null;
}

interface AvailableTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  name: string | null;
  requiredFields: string[];
  requiredActions: string[];
  allowedRoles: string[];
  order: number;
}

// ============================================================
// Required Action Labels
// ============================================================

export const REQUIRED_ACTION_LABELS: Record<string, string> = {
  LOG_COMMUNICATION: "Log a Communication",
  CREATE_TASK: "Create a Task",
  SEND_QUOTE: "Send a Quote",
  CONTRACT_SIGNED: "Get Contract Signed",
};

// ============================================================
// Required Field Labels by Entity Type
// ============================================================

export const ENTITY_REQUIRED_FIELDS: Record<string, { value: string; label: string }[]> = {
  LEAD: [
    { value: "estimatedValue", label: "Estimated Value" },
    { value: "eventType", label: "Event Type" },
    { value: "eventDate", label: "Event Date" },
    { value: "guestCount", label: "Guest Count" },
    { value: "description", label: "Description" },
    { value: "lostReason", label: "Lost Reason" },
  ],
  BOOKING: [
    { value: "totalAmount", label: "Total Amount" },
    { value: "eventType", label: "Event Type" },
    { value: "guestCount", label: "Guest Count" },
    { value: "specialRequests", label: "Special Requests" },
    { value: "internalNotes", label: "Internal Notes" },
  ],
  DEAL: [
    { value: "value", label: "Deal Value" },
    { value: "probability", label: "Probability" },
    { value: "expectedCloseDate", label: "Expected Close Date" },
    { value: "notes", label: "Notes" },
  ],
};

// ============================================================
// Validate Transition
// ============================================================
// Checks whether a status transition is allowed by the active
// blueprint for the given entity type.

export async function validateTransition(
  entityType: string,
  entityId: string,
  fromStatus: string,
  toStatus: string,
  userId: string,
  userRole: string
): Promise<TransitionValidationResult> {
  // 1. Find active blueprint for this entity type
  const blueprint = await prisma.blueprint.findFirst({
    where: {
      entityType,
      isActive: true,
      isPublished: true,
    },
    include: {
      transitions: {
        where: { isActive: true },
        orderBy: { order: "asc" },
      },
    },
  });

  // 2. No active blueprint = no enforcement
  if (!blueprint) {
    return { allowed: true, errors: [], transition: null };
  }

  // 3. Find matching transition
  const transition = blueprint.transitions.find(
    (t) => t.fromStatus === fromStatus && t.toStatus === toStatus
  );

  if (!transition) {
    return {
      allowed: false,
      errors: ["This status transition is not allowed by the active blueprint."],
      transition: null,
    };
  }

  const errors: string[] = [];
  const requiredFields = (transition.requiredFields as string[]) ?? [];
  const requiredActions = (transition.requiredActions as string[]) ?? [];
  const allowedRoles = transition.allowedRoles ?? [];

  // 4. Check allowed roles
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    errors.push(
      `Your role (${userRole.replace(/_/g, " ")}) is not authorized for this transition. Allowed: ${allowedRoles.map((r) => r.replace(/_/g, " ")).join(", ")}.`
    );
  }

  // 5. Check required fields — load entity from Prisma
  if (requiredFields.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entity: Record<string, any> | null = null;

    if (entityType === "LEAD") {
      entity = await prisma.lead.findUnique({ where: { id: entityId } });
    } else if (entityType === "BOOKING") {
      entity = await prisma.booking.findUnique({ where: { id: entityId } });
    } else if (entityType === "DEAL") {
      entity = await prisma.deal.findUnique({ where: { id: entityId } });
    }

    if (entity) {
      for (const field of requiredFields) {
        const value = entity[field];
        if (value === null || value === undefined || value === "") {
          const fieldLabel =
            ENTITY_REQUIRED_FIELDS[entityType]?.find((f) => f.value === field)?.label ?? field;
          errors.push(`Required field "${fieldLabel}" must be filled before this transition.`);
        }
      }
    }
  }

  // 6. Check required actions
  if (requiredActions.length > 0) {
    for (const action of requiredActions) {
      let actionMet = false;

      if (action === "LOG_COMMUNICATION" && entityType === "LEAD") {
        // Check if communication records exist for the lead's contact
        const lead = await prisma.lead.findUnique({
          where: { id: entityId },
          select: { contactId: true },
        });

        if (lead?.contactId) {
          const commCount = await prisma.communication.count({
            where: { contactId: lead.contactId },
          });
          actionMet = commCount > 0;
        }
      } else if (action === "LOG_COMMUNICATION") {
        // For BOOKING, check communications on the booking's contact
        if (entityType === "BOOKING") {
          const booking = await prisma.booking.findUnique({
            where: { id: entityId },
            select: { contactId: true },
          });
          if (booking?.contactId) {
            const commCount = await prisma.communication.count({
              where: { contactId: booking.contactId },
            });
            actionMet = commCount > 0;
          }
        }
      } else if (action === "SEND_QUOTE") {
        // Check if a quote exists for this lead
        if (entityType === "LEAD") {
          const quoteCount = await prisma.quote.count({
            where: { leadId: entityId },
          });
          actionMet = quoteCount > 0;
        }
      } else if (action === "CONTRACT_SIGNED") {
        // Check if a signed contract exists
        if (entityType === "BOOKING") {
          const contractCount = await prisma.contract.count({
            where: { bookingId: entityId, status: "SIGNED" },
          });
          actionMet = contractCount > 0;
        }
      } else {
        // For other actions, check ActivityLog
        const activityCount = await prisma.activityLog.count({
          where: {
            entityType,
            entityId,
            action: { contains: action, mode: "insensitive" },
          },
        });
        actionMet = activityCount > 0;
      }

      if (!actionMet) {
        const actionLabel = REQUIRED_ACTION_LABELS[action] ?? action;
        errors.push(`Required action "${actionLabel}" has not been completed.`);
      }
    }
  }

  return {
    allowed: errors.length === 0,
    errors,
    transition: {
      id: transition.id,
      name: transition.name,
      requiredFields,
      requiredActions,
      allowedRoles,
    },
  };
}

// ============================================================
// Get Available Transitions
// ============================================================
// Returns all allowed transitions from a given status for a
// specific user role. Returns null if no blueprint is active
// (meaning any transition is allowed).

export async function getAvailableTransitions(
  entityType: string,
  currentStatus: string,
  userRole: string
): Promise<AvailableTransition[] | null> {
  const blueprint = await prisma.blueprint.findFirst({
    where: {
      entityType,
      isActive: true,
      isPublished: true,
    },
    include: {
      transitions: {
        where: {
          isActive: true,
          fromStatus: currentStatus,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!blueprint) {
    return null; // No enforcement — any transition allowed
  }

  // Filter by role
  const available = blueprint.transitions.filter((t) => {
    if (t.allowedRoles.length === 0) return true;
    return t.allowedRoles.includes(userRole);
  });

  return available.map((t) => ({
    id: t.id,
    fromStatus: t.fromStatus,
    toStatus: t.toStatus,
    name: t.name,
    requiredFields: (t.requiredFields as string[]) ?? [],
    requiredActions: (t.requiredActions as string[]) ?? [],
    allowedRoles: t.allowedRoles,
    order: t.order,
  }));
}

// ============================================================
// Log Transition
// ============================================================
// Creates an audit log entry for a transition execution.

export async function logTransition(
  transitionId: string,
  entityType: string,
  entityId: string,
  fromStatus: string,
  toStatus: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.blueprintTransitionLog.create({
      data: {
        transitionId,
        entityType,
        entityId,
        fromStatus,
        toStatus,
        executedById: userId,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  } catch (error) {
    console.error("[BLUEPRINT_TRANSITION_LOG_ERROR]", error);
  }
}
