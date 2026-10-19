import { prisma } from "@/lib/prisma";
import { SALES_TEAMS, isSalesTeam, teamForEventType, type SalesTeamKey } from "./sales-team";

// ============================================================
// Sales teams — the database side: team settings rows, members, routing
// inside a team, and the backstop that sorts Unsorted leads.
// ============================================================

/** Roles that can be members of a sales team (and receive its leads). */
export const TEAM_MEMBER_ROLES = ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR"] as const;

/** Make sure the three team rows exist (idempotent). */
export async function ensureSalesTeams(): Promise<void> {
  await prisma.salesTeam.createMany({
    data: SALES_TEAMS.map((t) => ({ key: t.key })),
    skipDuplicates: true,
  });
}

/** Active members of a team, in a stable order (the rotation order). */
export async function salesTeamMembers(team: SalesTeamKey): Promise<{ id: string; name: string | null }[]> {
  return prisma.user.findMany({
    where: { salesTeam: team, isActive: true, role: { in: [...TEAM_MEMBER_ROLES] } },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

/**
 * Next owner for a new lead of this team: round-robin over the team's active
 * members, skipping anyone who marked themselves AWAY on the routing board
 * while someone else is available (if all are away it still rotates — a lead
 * must get an owner). OFFLINE is NOT skipped: it is the default for anyone who
 * never opened the board, so skipping it would send every lead to the one rep
 * who once pressed "Online". Returns null when the team has no members or auto-routing is
 * off, so the caller falls back to the existing assignment rules.
 *
 * The rotation index is advanced with a guarded update (compare-and-swap), so
 * two leads arriving together don't both go to the same person.
 */
export async function pickTeamAssignee(teamValue: string | null | undefined): Promise<string | null> {
  if (!isSalesTeam(teamValue)) return null;
  const team = teamValue;
  await ensureSalesTeams();
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await prisma.salesTeam.findUnique({ where: { key: team }, select: { autoRoute: true, lastAssignedIdx: true } });
    if (!row || !row.autoRoute) return null;
    const members = await salesTeamMembers(team);
    if (members.length === 0) return null;
    const availability = await prisma.repAvailability.findMany({
      where: { userId: { in: members.map((m) => m.id) } },
      select: { userId: true, status: true },
    });
    const away = new Set(availability.filter((a) => a.status === "AWAY").map((a) => a.userId));
    const anyAvailable = members.some((m) => !away.has(m.id));
    let idx = row.lastAssignedIdx;
    let chosen: number | null = null;
    for (let step = 1; step <= members.length; step++) {
      const i = (row.lastAssignedIdx + step + members.length) % members.length;
      if (!anyAvailable || !away.has(members[i].id)) {
        chosen = i;
        break;
      }
    }
    if (chosen === null) return null;
    idx = chosen;
    const won = await prisma.salesTeam.updateMany({
      where: { key: team, lastAssignedIdx: row.lastAssignedIdx },
      data: { lastAssignedIdx: idx },
    });
    if (won.count === 1) return members[idx].id;
  }
  return null;
}

/**
 * Backstop: give every Unsorted lead whose event type now names a team that
 * team (never touching a lead a person sorted by hand). Idempotent; used by
 * the frequent cron lane and the "Sort now" button.
 */
export async function sortUnsortedLeads(limit = 2000): Promise<{ sorted: number; stillUnsorted: number }> {
  const rows = await prisma.lead.findMany({
    where: { deletedAt: null, salesTeam: null, salesTeamManual: false, eventType: { not: null } },
    select: { id: true, eventType: true },
    take: limit,
  });
  const byTeam = new Map<SalesTeamKey, string[]>();
  for (const r of rows) {
    const team = teamForEventType(r.eventType);
    if (team) byTeam.set(team, [...(byTeam.get(team) ?? []), r.id]);
  }
  let sorted = 0;
  for (const [team, ids] of byTeam) {
    const res = await prisma.lead.updateMany({
      where: { id: { in: ids }, salesTeam: null, salesTeamManual: false },
      data: { salesTeam: team },
    });
    sorted += res.count;
  }
  const stillUnsorted = await prisma.lead.count({ where: { deletedAt: null, salesTeam: null } });
  return { sorted, stillUnsorted };
}
