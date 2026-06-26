"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import {
  getOrCreateRepAvailability,
  markRepStatus,
  touchRepHeartbeat,
} from "@/lib/routing/rep-availability";
import {
  repAvailabilityStatusSchema,
  routingSkillsSchema,
  repAvailabilityPatchSchema,
  type RoutingSkillsInput,
  type RepAvailabilityPatchInput,
} from "@/schemas/rep-availability.schema";

// ============================================================
// Rep availability actions — self-service + manager/admin
// ============================================================
// Self-service (setMyAvailability / updateMyRoutingSkills / getMyAvailability /
// touchMyHeartbeat) require only an authenticated internal session (role not
// CLIENT) and ALWAYS key on session.user.id — a rep can only ever mutate their
// OWN row. Cross-rep override (setRepAvailabilityForUser) and the team board
// (getTeamAvailability) are RBAC-gated. Counts are Int — no Decimal anywhere.

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface RepAvailabilityData {
  id: string;
  userId: string;
  status: string;
  openLeadCount: number;
  capacityLimit: number;
  eventTypeSkills: string[];
  languages: string[];
  lastSeenAt: string | null;
  autoOfflineAfterMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamAvailabilityRow extends RepAvailabilityData {
  user: { id: string; name: string | null; email: string; role: string } | null;
}

export interface RoutingDecisionData {
  id: string;
  leadId: string;
  assignedToId: string | null;
  method: string;
  matchedEventType: boolean;
  matchedLanguage: boolean;
  repLoadAtDecision: number;
  ruleId: string | null;
  scoreBreakdown: unknown;
  createdAt: string;
  assignedTo: { id: string; name: string | null; email: string } | null;
}

// ------------------------------------------------------------
// Self-service (authenticated internal user, own row only)
// ------------------------------------------------------------

export async function setMyAvailability(
  status: string
): Promise<Result<RepAvailabilityData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (session.user.role === "CLIENT") {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = repAvailabilityStatusSchema.safeParse(status);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid status" };
    }

    // Hard-gate: key strictly on the session user — never accept a userId param.
    const row = await markRepStatus(session.user.id, parsed.data);

    logActivity({
      action: "SET_AVAILABILITY",
      entityType: "rep_availability",
      entityId: row.id,
      changes: { status: parsed.data },
      userId: session.user.id,
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return {
      success: true as const,
      data: serialize(row) as unknown as RepAvailabilityData,
    };
  } catch (error) {
    console.error("setMyAvailability error:", error);
    return { success: false as const, error: "Failed to update availability" };
  }
}

export async function updateMyRoutingSkills(
  input: RoutingSkillsInput
): Promise<Result<RepAvailabilityData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (session.user.role === "CLIENT") {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = routingSkillsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    // Ensure the row exists, then patch — own id only.
    await getOrCreateRepAvailability(session.user.id);
    const row = await prisma.repAvailability.update({
      where: { userId: session.user.id },
      data: {
        eventTypeSkills: parsed.data.eventTypeSkills,
        languages: parsed.data.languages,
        capacityLimit: parsed.data.capacityLimit,
      },
    });

    logActivity({
      action: "UPDATE_ROUTING_SKILLS",
      entityType: "rep_availability",
      entityId: row.id,
      changes: {
        eventTypeSkills: parsed.data.eventTypeSkills,
        languages: parsed.data.languages,
        capacityLimit: parsed.data.capacityLimit,
      },
      userId: session.user.id,
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return {
      success: true as const,
      data: serialize(row) as unknown as RepAvailabilityData,
    };
  } catch (error) {
    console.error("updateMyRoutingSkills error:", error);
    return { success: false as const, error: "Failed to update skills" };
  }
}

export async function getMyAvailability(): Promise<Result<RepAvailabilityData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (session.user.role === "CLIENT") {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const row = await getOrCreateRepAvailability(session.user.id);
    return {
      success: true as const,
      data: serialize(row) as unknown as RepAvailabilityData,
    };
  } catch (error) {
    console.error("getMyAvailability error:", error);
    return { success: false as const, error: "Failed to load availability" };
  }
}

/**
 * Heartbeat ping — keeps the caller's lastSeenAt fresh so SMART routing keeps
 * them eligible. Own row only; returns nothing leaky.
 */
export async function touchMyHeartbeat(): Promise<Result<{ status: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (session.user.role === "CLIENT") {
      return { success: false as const, error: "Insufficient permissions" };
    }
    const row = await touchRepHeartbeat(session.user.id);
    return { success: true as const, data: { status: row.status } };
  } catch (error) {
    console.error("touchMyHeartbeat error:", error);
    return { success: false as const, error: "Failed to ping heartbeat" };
  }
}

// ------------------------------------------------------------
// Manager / admin
// ------------------------------------------------------------

export async function getTeamAvailability(): Promise<
  Result<TeamAvailabilityRow[]>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:assign")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const rows = await prisma.repAvailability.findMany({
      orderBy: [{ status: "asc" }, { openLeadCount: "asc" }],
    });

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, email: true, role: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const data: TeamAvailabilityRow[] = rows.map((r) => ({
      ...(serialize(r) as unknown as RepAvailabilityData),
      user: userById.get(r.userId) ?? null,
    }));

    return { success: true as const, data };
  } catch (error) {
    console.error("getTeamAvailability error:", error);
    return { success: false as const, error: "Failed to load team availability" };
  }
}

export async function setRepAvailabilityForUser(
  userId: string,
  patch: RepAvailabilityPatchInput
): Promise<Result<RepAvailabilityData>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "settings:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }
    if (!userId) {
      return { success: false as const, error: "User is required" };
    }

    const parsed = repAvailabilityPatchSchema.safeParse(patch);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) {
      return { success: false as const, error: "User not found" };
    }

    const row = await prisma.repAvailability.upsert({
      where: { userId },
      create: { userId, ...parsed.data },
      update: { ...parsed.data },
    });

    logActivity({
      action: "OVERRIDE_REP_AVAILABILITY",
      entityType: "rep_availability",
      entityId: row.id,
      changes: { targetUserId: userId, ...parsed.data },
      userId: session.user.id,
    }).catch((e) => console.error("[LOG_ACTIVITY_ERROR]", e));

    return {
      success: true as const,
      data: serialize(row) as unknown as RepAvailabilityData,
    };
  } catch (error) {
    console.error("setRepAvailabilityForUser error:", error);
    return { success: false as const, error: "Failed to override availability" };
  }
}

export async function getRoutingDecisions(args?: {
  leadId?: string;
}): Promise<Result<RoutingDecisionData[]>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role, "leads:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const decisions = await prisma.leadRoutingDecision.findMany({
      where: args?.leadId ? { leadId: args.leadId } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const assigneeIds = Array.from(
      new Set(
        decisions
          .map((d) => d.assignedToId)
          .filter((id): id is string => !!id)
      )
    );
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const byId = new Map(assignees.map((u) => [u.id, u]));

    const data: RoutingDecisionData[] = decisions.map((d) => ({
      ...(serialize(d) as unknown as Omit<RoutingDecisionData, "assignedTo">),
      assignedTo: d.assignedToId ? byId.get(d.assignedToId) ?? null : null,
    }));

    return { success: true as const, data };
  } catch (error) {
    console.error("getRoutingDecisions error:", error);
    return { success: false as const, error: "Failed to load routing decisions" };
  }
}
