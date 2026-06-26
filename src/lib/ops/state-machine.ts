// ============================================================
// Event-ops state machine + readiness — the single source of truth for which
// status transitions are legal across every ops entity, and for deriving an
// EventOperation's overall readiness from its children.
// ------------------------------------------------------------
// Why centralize: each sub-module (BEO, Kitchen, Procurement, Logistics,
// Support, the EventOperation hub itself) previously validated its own status
// ad-hoc — or not at all (KitchenPlan could flip COMPLETED→PLANNED). Routing
// every transition through assertTransition() makes the lifecycle uniform and
// testable, and computeOperationReadiness() turns the aggregate root's status
// into a function of its parts instead of a hand-set flag.
// ============================================================

import { prisma } from "@/lib/prisma";

export type OpsEntity =
  | "operation"
  | "beo"
  | "kitchen"
  | "procurement"
  | "dispatch"
  | "support"
  | "vendorAssignment";

/**
 * Legal forward (and the few intentional backward) transitions per entity.
 * A `from` not present here, or a `to` not in its list, is rejected. Terminal
 * states map to an empty array.
 */
export const OPS_TRANSITIONS: Record<OpsEntity, Record<string, string[]>> = {
  // EventOperation aggregate root (OperationStatus enum).
  operation: {
    PLANNING: ["READY"],
    READY: ["LIVE", "PLANNING"], // can drop back to PLANNING if a gate regresses
    LIVE: ["COMPLETED"],
    COMPLETED: [],
  },
  beo: {
    DRAFT: ["PUBLISHED"],
    PUBLISHED: ["LOCKED", "DRAFT"], // unpublish to edit
    LOCKED: [],
  },
  kitchen: {
    PLANNED: ["IN_PROGRESS"],
    IN_PROGRESS: ["COMPLETED"],
    COMPLETED: [],
  },
  procurement: {
    PENDING: ["APPROVED", "REJECTED"],
    APPROVED: ["ORDERED"],
    ORDERED: ["RECEIVED"],
    RECEIVED: [],
    REJECTED: [],
  },
  dispatch: {
    PLANNED: ["DISPATCHED", "CANCELLED"],
    DISPATCHED: ["DELIVERED"],
    DELIVERED: ["RETURNED"],
    RETURNED: [],
    CANCELLED: [],
  },
  support: {
    // Superset of the prior local table: any non-terminal-ish state can reopen
    // to OPEN or move forward, so existing ticket flows are never blocked.
    OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
    IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
    RESOLVED: ["OPEN", "CLOSED", "IN_PROGRESS"], // reopen
    CLOSED: ["OPEN", "IN_PROGRESS"], // reopen
  },
  vendorAssignment: {
    NOTIFIED: ["CONFIRMED", "DECLINED"],
    CONFIRMED: ["DECLINED"],
    DECLINED: ["CONFIRMED"],
  },
};

export interface TransitionCheck {
  ok: boolean;
  error?: string;
}

/**
 * Validate a status change. Same-state is a no-op (ok). Use BEFORE writing so a
 * caller can return a friendly error instead of corrupting the lifecycle.
 */
export function assertTransition(entity: OpsEntity, from: string, to: string): TransitionCheck {
  if (from === to) return { ok: true };
  const map = OPS_TRANSITIONS[entity];
  const allowed = map[from];
  if (!allowed) return { ok: false, error: `Unknown ${entity} status "${from}".` };
  if (!allowed.includes(to)) {
    const opts = allowed.length ? allowed.join(", ") : "none (terminal state)";
    return { ok: false, error: `Can't move ${entity} from ${from} to ${to}. Allowed: ${opts}.` };
  }
  return { ok: true };
}

// ------------------------------------------------------------
// Readiness — derive the aggregate operation's "are we ready?" from children.
// ------------------------------------------------------------

export interface ReadinessGate {
  key: string;
  label: string;
  ready: boolean;
  /** Required gates must all be ready before the operation can go LIVE. */
  required: boolean;
  detail?: string;
}

export interface OperationReadiness {
  operationId: string;
  gates: ReadinessGate[];
  readyCount: number;
  totalCount: number;
  readyPct: number;
  /** True when every REQUIRED gate is ready (safe to flip the op to LIVE). */
  canGoLive: boolean;
}

/**
 * Compute the readiness checklist for an EventOperation from the live state of
 * its BEO, kitchen plan, requisitions, dispatches, vendor assignments, staffing
 * and execution tasks. A gate with no underlying work (e.g. no requisitions) is
 * "ready" — nothing is blocking. Required gates gate the LIVE transition.
 */
export async function computeOperationReadiness(operationId: string): Promise<OperationReadiness | null> {
  const op = await prisma.eventOperation.findUnique({
    where: { id: operationId },
    select: {
      id: true,
      beos: { select: { status: true } },
      kitchenPlans: { select: { status: true } },
      purchaseRequisitions: { select: { status: true } },
      dispatchOrders: { select: { status: true } },
      vendorAssignments: { select: { status: true } },
      staffAssignments: { select: { status: true } },
    },
  });
  if (!op) return null;

  const beo = op.beos[0];
  const kitchen = op.kitchenPlans[0];

  // Mandatory execution tasks not yet completed (via plan.operationId link).
  const openMandatoryTasks = await prisma.executionTask.count({
    where: {
      isMandatory: true,
      status: { not: "COMPLETED" },
      phase: { plan: { operationId } },
    },
  });

  const prsOpen = op.purchaseRequisitions.filter(
    (p) => !["RECEIVED", "REJECTED"].includes(p.status)
  ).length;
  const dispatchOpen = op.dispatchOrders.filter(
    (d) => !["DELIVERED", "RETURNED", "CANCELLED"].includes(d.status)
  ).length;
  const vendorsOpen = op.vendorAssignments.filter((v) => v.status !== "CONFIRMED").length;
  const staffOpen = op.staffAssignments.filter(
    (s) => !["CONFIRMED", "CHECKED_IN"].includes(s.status)
  ).length;

  const gates: ReadinessGate[] = [
    {
      key: "beo",
      label: "Function sheet published",
      required: true,
      ready: !!beo && ["PUBLISHED", "LOCKED"].includes(beo.status),
      detail: beo ? `BEO ${beo.status}` : "No BEO yet",
    },
    {
      key: "tasks",
      label: "Mandatory tasks complete",
      required: true,
      ready: openMandatoryTasks === 0,
      detail: openMandatoryTasks ? `${openMandatoryTasks} open` : "All done",
    },
    {
      key: "vendors",
      label: "Vendors confirmed",
      required: true,
      ready: vendorsOpen === 0,
      detail: vendorsOpen ? `${vendorsOpen} pending` : "All confirmed",
    },
    {
      key: "kitchen",
      label: "Kitchen plan finalised",
      required: false,
      ready: !kitchen || kitchen.status === "COMPLETED",
      detail: kitchen ? `Kitchen ${kitchen.status}` : "No kitchen plan",
    },
    {
      key: "procurement",
      label: "Procurement received",
      required: false,
      ready: prsOpen === 0,
      detail: prsOpen ? `${prsOpen} open` : "Clear",
    },
    {
      key: "logistics",
      label: "Dispatches settled",
      required: false,
      ready: dispatchOpen === 0,
      detail: dispatchOpen ? `${dispatchOpen} in flight` : "Clear",
    },
    {
      key: "staff",
      label: "Staff confirmed",
      required: false,
      ready: staffOpen === 0,
      detail: staffOpen ? `${staffOpen} unconfirmed` : "All confirmed",
    },
  ];

  const readyCount = gates.filter((g) => g.ready).length;
  const totalCount = gates.length;
  const canGoLive = gates.filter((g) => g.required).every((g) => g.ready);

  return {
    operationId,
    gates,
    readyCount,
    totalCount,
    readyPct: Math.round((readyCount / totalCount) * 100),
    canGoLive,
  };
}
