"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";
import { canSeeAllLeads, resolveTeamView } from "@/lib/crm/lead-filters";
import { leadViewer } from "@/lib/crm/lead-viewer";
import { SALES_TEAMS, UNSORTED, isSalesTeam, salesTeamLabel } from "@/lib/crm/sales-team";
import { TEAM_MEMBER_ROLES, ensureSalesTeams, sortUnsortedLeads } from "@/lib/crm/sales-team-db";

// ============================================================
// Sales teams (Wedding / Corporate / Social): the settings screen and the
// team dashboard. Settings are for lead managers (leads:assign — the same
// people who can see every team); the dashboard is for everyone, each rep
// held to their own team.
// ============================================================

type Fail = { success: false; error: string };

async function requireManager(): Promise<{ userId: string } | Fail> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role ?? "", "leads:assign")) {
    return { success: false, error: "Only sales heads and admins can change sales teams." };
  }
  return { userId: session.user.id };
}

export interface SalesTeamSettings {
  teams: { key: string; label: string; headUserId: string | null; autoRoute: boolean; memberCount: number; openLeads: number }[];
  people: { id: string; name: string; email: string; role: string; salesTeam: string | null }[];
  unsorted: number;
}

export async function getSalesTeamSettings(): Promise<{ success: true; data: SalesTeamSettings } | Fail> {
  const gate = await requireManager();
  if ("success" in gate) return gate;
  try {
    await ensureSalesTeams();
    const [rows, people, open, unsorted] = await Promise.all([
      prisma.salesTeam.findMany(),
      prisma.user.findMany({
        where: { isActive: true, role: { in: [...TEAM_MEMBER_ROLES] } },
        select: { id: true, name: true, email: true, role: true, salesTeam: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.lead.groupBy({
        by: ["salesTeam"],
        where: { deletedAt: null, status: { notIn: ["WON", "LOST"] } },
        _count: { _all: true },
      }),
      prisma.lead.count({ where: { deletedAt: null, salesTeam: null, status: { notIn: ["WON", "LOST"] } } }),
    ]);
    const teams = SALES_TEAMS.map((t) => {
      const row = rows.find((r) => r.key === t.key);
      return {
        key: t.key,
        label: t.label,
        headUserId: row?.headUserId ?? null,
        autoRoute: row?.autoRoute ?? true,
        memberCount: people.filter((p) => p.salesTeam === t.key).length,
        openLeads: open.find((o) => o.salesTeam === t.key)?._count._all ?? 0,
      };
    });
    return {
      success: true,
      data: {
        teams,
        people: people.map((p) => ({ id: p.id, name: p.name ?? p.email, email: p.email, role: p.role, salesTeam: p.salesTeam })),
        unsorted,
      },
    };
  } catch (error) {
    console.error("[GET_SALES_TEAM_SETTINGS_ERROR]", error);
    return { success: false, error: "Could not load the sales teams." };
  }
}

/** Put a rep in a team (or take them out with null). Their open leads stay where they are. */
export async function setUserSalesTeam(userId: string, team: string | null): Promise<{ success: true } | Fail> {
  const gate = await requireManager();
  if ("success" in gate) return gate;
  if (team !== null && !isSalesTeam(team)) return { success: false, error: "Unknown team." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, salesTeam: true } });
  if (!user || !(TEAM_MEMBER_ROLES as readonly string[]).includes(user.role)) {
    return { success: false, error: "Only sales staff can be put in a sales team." };
  }
  if (user.salesTeam === team) return { success: true };
  await prisma.user.update({ where: { id: userId }, data: { salesTeam: team } });
  await logActivity({
    userId: gate.userId,
    action: "user_sales_team_changed",
    entityType: "User",
    entityId: userId,
    changes: { from: salesTeamLabel(user.salesTeam), to: salesTeamLabel(team) },
  });
  revalidatePath("/settings/sales-teams");
  return { success: true };
}

/** Team head and the auto-routing switch. */
export async function updateSalesTeam(
  key: string,
  patch: { headUserId?: string | null; autoRoute?: boolean },
): Promise<{ success: true } | Fail> {
  const gate = await requireManager();
  if ("success" in gate) return gate;
  if (!isSalesTeam(key)) return { success: false, error: "Unknown team." };
  const data: { headUserId?: string | null; autoRoute?: boolean } = {};
  if (patch.headUserId !== undefined) {
    if (patch.headUserId !== null) {
      const head = await prisma.user.findUnique({ where: { id: patch.headUserId }, select: { isActive: true } });
      if (!head?.isActive) return { success: false, error: "Pick an active user as the team head." };
    }
    data.headUserId = patch.headUserId;
  }
  if (typeof patch.autoRoute === "boolean") data.autoRoute = patch.autoRoute;
  await ensureSalesTeams();
  await prisma.salesTeam.update({ where: { key }, data });
  await logActivity({ userId: gate.userId, action: "sales_team_updated", entityType: "SalesTeam", entityId: key, changes: data });
  revalidatePath("/settings/sales-teams");
  return { success: true };
}

/** "Sort now": the same backstop the cron runs, on demand. */
export async function sortUnsortedLeadsNow(): Promise<{ success: true; sorted: number; stillUnsorted: number } | Fail> {
  const gate = await requireManager();
  if ("success" in gate) return gate;
  try {
    const res = await sortUnsortedLeads();
    revalidatePath("/settings/sales-teams");
    revalidatePath("/leads");
    return { success: true, ...res };
  } catch (error) {
    console.error("[SORT_UNSORTED_LEADS_ERROR]", error);
    return { success: false, error: "Sorting failed. Try again." };
  }
}

// ------------------------------------------------------------
// Team dashboard
// ------------------------------------------------------------

export interface TeamDashboardRow {
  key: string; // team key or UNSORTED
  label: string;
  open: number;
  newInPeriod: number;
  noOwner: number;
  followUpsDue: number;
  awaitingFirstReply: number;
  medianFirstReplyMins: number | null;
  wonInPeriod: number;
  wonValue: number;
  reps: { id: string | null; name: string; open: number; wonInPeriod: number }[];
}

const OPEN = { notIn: ["WON" as const, "LOST" as const] };

export async function getSalesTeamDashboard(input?: { team?: string; days?: number }): Promise<
  { success: true; data: { rows: TeamDashboardRow[]; canSwitch: boolean; viewerTeam: string | null; days: number } } | Fail
> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "Unauthorized" };
  if (!hasPermission(session.user.role ?? "", "leads:read")) return { success: false, error: "Insufficient permissions" };
  try {
    const viewer = await leadViewer(session.user);
    const canSwitch = canSeeAllLeads(viewer.role);
    const only = resolveTeamView(viewer, input?.team);
    // A rep in no team has no team to report on.
    if (!canSwitch && !only) {
      return { success: true, data: { rows: [], canSwitch, viewerTeam: null, days: 30 } };
    }
    const days = [7, 30, 90].includes(input?.days ?? 0) ? (input?.days as number) : 30;
    const now = new Date();
    const since = new Date(now.getTime() - days * 86_400_000);
    const keys: string[] = only ? [only] : [...SALES_TEAMS.map((t) => t.key), UNSORTED];
    const teamWhere = (key: string) => ({ salesTeam: key === UNSORTED ? null : key });

    const rows: TeamDashboardRow[] = [];
    for (const key of keys) {
      const base = { deletedAt: null, ...teamWhere(key) };
      const [open, newInPeriod, noOwner, followUpsDue, awaitingFirstReply, replied, won, openByRep, wonByRep] = await Promise.all([
        prisma.lead.count({ where: { ...base, status: OPEN } }),
        prisma.lead.count({ where: { ...base, createdAt: { gte: since } } }),
        prisma.lead.count({ where: { ...base, status: OPEN, assignedToId: null } }),
        prisma.lead.count({ where: { ...base, status: OPEN, followUpDate: { lte: now } } }),
        prisma.lead.count({ where: { ...base, status: OPEN, firstRespondedAt: null, firstContactDue: { lt: now } } }),
        prisma.lead.findMany({
          where: { ...base, createdAt: { gte: since }, firstRespondedAt: { not: null } },
          select: { createdAt: true, firstRespondedAt: true },
        }),
        prisma.lead.findMany({
          where: { ...base, wonAt: { gte: since } },
          select: { bookingValue: true, estimatedValue: true },
        }),
        prisma.lead.groupBy({ by: ["assignedToId"], where: { ...base, status: OPEN }, _count: { _all: true } }),
        prisma.lead.groupBy({ by: ["assignedToId"], where: { ...base, wonAt: { gte: since } }, _count: { _all: true } }),
      ]);
      const mins = replied
        .map((r) => (r.firstRespondedAt!.getTime() - r.createdAt.getTime()) / 60_000)
        .filter((m) => m >= 0)
        .sort((a, b) => a - b);
      const median = mins.length ? Math.round(mins[Math.floor((mins.length - 1) / 2)]) : null;
      const repIds = [...new Set([...openByRep, ...wonByRep].map((r) => r.assignedToId).filter((x): x is string => !!x))];
      const names = repIds.length
        ? await prisma.user.findMany({ where: { id: { in: repIds } }, select: { id: true, name: true, email: true } })
        : [];
      const repKeys: (string | null)[] = [...repIds, ...(openByRep.some((r) => !r.assignedToId) ? [null] : [])];
      const reps = repKeys
        .map((id) => {
          const u = names.find((n) => n.id === id);
          return {
            id,
            name: id === null ? "No owner" : (u?.name ?? u?.email ?? "Unknown"),
            open: openByRep.find((r) => r.assignedToId === id)?._count._all ?? 0,
            wonInPeriod: wonByRep.find((r) => r.assignedToId === id)?._count._all ?? 0,
          };
        })
        .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
      rows.push({
        key,
        label: key === UNSORTED ? "Unsorted" : salesTeamLabel(key),
        open,
        newInPeriod,
        noOwner,
        followUpsDue,
        awaitingFirstReply,
        medianFirstReplyMins: median,
        wonInPeriod: won.length,
        wonValue: won.reduce((s, w) => s + Number(w.bookingValue ?? w.estimatedValue ?? 0), 0),
        reps,
      });
    }
    return { success: true, data: { rows, canSwitch, viewerTeam: viewer.salesTeam ?? null, days } };
  } catch (error) {
    console.error("[GET_SALES_TEAM_DASHBOARD_ERROR]", error);
    return { success: false, error: "Could not load the team dashboard." };
  }
}
