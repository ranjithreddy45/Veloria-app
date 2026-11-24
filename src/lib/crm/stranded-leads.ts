import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { scheduleLeadsAssignedNotify } from "@/lib/crm/lead-assigned-notify";
import { pickTeamAssignee } from "@/lib/crm/sales-team-db";

// ============================================================
// Leads stranded on people who have left.
//
// Deactivating a user revokes their login but left every lead they owned
// pointing at them: no reminders (those skip inactive staff), no SLA nudges,
// nobody calling. About 216–273 open leads sat like that in Nov 2026.
//
// This finds them and moves them, on a manager's say-so, either all to one
// person or shared round-robin across each lead's sales team (with a named
// fallback for leads whose team has nobody on it). Open tasks and the deal for
// each moved lead follow it. The new owners get the usual "leads assigned to
// you" notice, one per person for the whole batch.
// ============================================================

/** Only roles a lead may be assigned to (mirrors ASSIGNABLE_ROLES in lead.actions.ts). */
export const ASSIGNABLE_ROLES = ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"];

const OPEN_LEAD = { deletedAt: null, status: { notIn: ["WON", "LOST"] as ("WON" | "LOST")[] } };

export interface StrandedOwner {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  openLeads: number;
}

/** Every deactivated person who still owns open leads, most leads first. */
export async function strandedLeadOwners(): Promise<StrandedOwner[]> {
  const groups = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: { ...OPEN_LEAD, assignedTo: { isActive: false } },
    _count: { _all: true },
  });
  const ids = groups.map((g) => g.assignedToId).filter((id): id is string => !!id);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, role: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return groups
    .filter((g) => g.assignedToId && byId.has(g.assignedToId))
    .map((g) => {
      const u = byId.get(g.assignedToId!)!;
      return { userId: u.id, name: u.name, email: u.email, role: u.role, openLeads: g._count._all };
    })
    .sort((a, b) => b.openLeads - a.openLeads);
}

/** Open leads owned by one user (used to warn when deactivating them). */
export async function openLeadCount(userId: string): Promise<number> {
  return prisma.lead.count({ where: { ...OPEN_LEAD, assignedToId: userId } });
}

export interface ReassignInput {
  /** Deactivated owners whose open leads move. */
  fromUserIds: string[];
  /** "person": everything to toUserId. "team": round-robin within each lead's team, toUserId for the rest. */
  mode: "person" | "team";
  toUserId: string;
  actorId: string;
}

export interface ReassignResult {
  moved: number;
  /** How many went to whom. */
  byAssignee: { userId: string; count: number }[];
  /** Leads skipped because someone changed their owner meanwhile. */
  skipped: number;
}

/** Validate a destination: an active person in an assignable role. */
export async function destinationError(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true, role: true } });
  if (!u || !u.isActive || !ASSIGNABLE_ROLES.includes(u.role)) return "Choose an active sales person or admin.";
  return null;
}

export async function reassignStrandedLeads(input: ReassignInput): Promise<ReassignResult> {
  const fromIds = Array.from(new Set(input.fromUserIds.filter(Boolean)));
  if (fromIds.length === 0) return { moved: 0, byAssignee: [], skipped: 0 };

  // Only owners that really are deactivated: this tool never takes leads off
  // someone still working.
  const inactive = (
    await prisma.user.findMany({ where: { id: { in: fromIds }, isActive: false }, select: { id: true } })
  ).map((u) => u.id);
  if (inactive.length === 0) return { moved: 0, byAssignee: [], skipped: 0 };

  const leads = await prisma.lead.findMany({
    where: { ...OPEN_LEAD, assignedToId: { in: inactive } },
    select: { id: true, salesTeam: true, assignedToId: true },
    orderBy: { createdAt: "asc" },
  });

  // Decide each lead's new owner.
  const plan = new Map<string, string[]>(); // newOwner -> leadIds
  for (const lead of leads) {
    const to =
      input.mode === "team" ? (await pickTeamAssignee(lead.salesTeam)) ?? input.toUserId : input.toUserId;
    const list = plan.get(to) ?? [];
    list.push(lead.id);
    plan.set(to, list);
  }

  let moved = 0;
  const byAssignee: { userId: string; count: number }[] = [];
  for (const [to, ids] of plan) {
    // Guarded: only leads still owned by a departed person move, so a lead a
    // manager picked up by hand a moment ago is left alone.
    const stillStranded = (
      await prisma.lead.findMany({
        where: { id: { in: ids }, assignedToId: { in: inactive } },
        select: { id: true, assignedToId: true },
      })
    );
    const moveIds = stillStranded.map((l) => l.id);
    if (moveIds.length === 0) continue;

    const res = await prisma.$transaction(async (tx) => {
      const updated = await tx.lead.updateMany({
        where: { id: { in: moveIds }, assignedToId: { in: inactive } },
        data: { assignedToId: to },
      });
      // Open tasks on those leads that were the departed person's follow the lead.
      await tx.task.updateMany({
        where: { leadId: { in: moveIds }, assigneeId: { in: inactive }, status: { not: "DONE" } },
        data: { assigneeId: to },
      });
      // So does the lead's deal, if the departed person held it.
      await tx.deal.updateMany({
        where: { leadId: { in: moveIds }, assignedToId: { in: inactive } },
        data: { assignedToId: to },
      });
      return updated.count;
    });
    if (res === 0) continue;
    moved += res;
    byAssignee.push({ userId: to, count: res });

    const fromOf = new Map(stillStranded.map((l) => [l.id, l.assignedToId]));
    for (let i = 0; i < moveIds.length; i += 50) {
      await Promise.all(
        moveIds.slice(i, i + 50).map((id) =>
          logActivity({
            action: "REASSIGN_FROM_INACTIVE",
            entityType: "lead",
            entityId: id,
            changes: { assignedToId: { from: fromOf.get(id) ?? null, to } },
            userId: input.actorId,
          })
        )
      );
    }

    scheduleLeadsAssignedNotify({ leadIds: moveIds, assigneeId: to, assignedById: input.actorId });
  }

  return { moved, byAssignee, skipped: leads.length - moved };
}
