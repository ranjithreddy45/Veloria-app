"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  strandedLeadOwners,
  reassignStrandedLeads,
  destinationError,
  ASSIGNABLE_ROLES,
  type StrandedOwner,
} from "@/lib/crm/stranded-leads";

// Leads still owned by deactivated staff, and moving them to someone who can
// act on them (src/lib/crm/stranded-leads.ts). Gated on leads:assign, the same
// permission as bulk-assigning leads from the list.

type Fail = { success: false; error: string };

export async function getStrandedLeads(): Promise<
  | {
      success: true;
      data: {
        owners: StrandedOwner[];
        total: number;
        destinations: { id: string; name: string | null; role: string; salesTeam: string | null }[];
      };
    }
  | Fail
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role, "leads:assign")) return { success: false, error: "Insufficient permissions" };

    const [owners, destinations] = await Promise.all([
      strandedLeadOwners(),
      prisma.user.findMany({
        where: { isActive: true, role: { in: ASSIGNABLE_ROLES as never } },
        select: { id: true, name: true, role: true, salesTeam: true },
        orderBy: { name: "asc" },
      }),
    ]);
    return {
      success: true,
      data: { owners, total: owners.reduce((s, o) => s + o.openLeads, 0), destinations },
    };
  } catch (e) {
    console.error("[GET_STRANDED_LEADS]", e);
    return { success: false, error: "Could not load leads with staff who have left." };
  }
}

export async function reassignLeadsFromInactiveStaff(input: {
  fromUserIds: string[];
  mode: "person" | "team";
  toUserId: string;
}): Promise<{ success: true; data: { moved: number; skipped: number; byAssignee: { name: string | null; count: number }[] } } | Fail> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    if (!hasPermission(session.user.role, "leads:assign")) return { success: false, error: "Insufficient permissions" };

    const fromUserIds = Array.isArray(input?.fromUserIds)
      ? input.fromUserIds.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 200)
      : [];
    if (fromUserIds.length === 0) return { success: false, error: "Choose whose leads to move." };
    if (input.mode !== "person" && input.mode !== "team") return { success: false, error: "Choose how to share the leads." };
    if (typeof input.toUserId !== "string" || !input.toUserId) return { success: false, error: "Choose who gets the leads." };
    if (fromUserIds.includes(input.toUserId)) return { success: false, error: "That person has left; choose someone active." };
    const bad = await destinationError(input.toUserId);
    if (bad) return { success: false, error: bad };

    const res = await reassignStrandedLeads({
      fromUserIds,
      mode: input.mode,
      toUserId: input.toUserId,
      actorId: session.user.id,
    });

    const names = await prisma.user.findMany({
      where: { id: { in: res.byAssignee.map((b) => b.userId) } },
      select: { id: true, name: true },
    });
    const nameOf = new Map(names.map((u) => [u.id, u.name]));

    revalidatePath("/settings/users");
    revalidatePath("/leads");
    return {
      success: true,
      data: {
        moved: res.moved,
        skipped: res.skipped,
        byAssignee: res.byAssignee.map((b) => ({ name: nameOf.get(b.userId) ?? null, count: b.count })),
      },
    };
  } catch (e) {
    console.error("[REASSIGN_STRANDED_LEADS]", e);
    return { success: false, error: "Could not move all the leads. Refresh to see what is left and try again." };
  }
}
