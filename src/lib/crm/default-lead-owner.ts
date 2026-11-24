import { prisma } from "@/lib/prisma";

// ============================================================
// Who owns a lead nothing else routed.
//
// When no assignment rule (or team rotation) picks an owner, an inbound lead
// still needs one: the Leads list opens on "My leads", so an unowned lead is
// invisible. That fallback used to be "the first active admin" from a query
// with no ORDER BY, i.e. whichever admin row Postgres returned first. In
// production that was Venkat, which nobody chose.
//
// Now it is a named person: DEFAULT_LEAD_OWNER_EMAIL (set to Rajitha in Nov
// 2026). If that is unset, or the person is deactivated or not in a role that
// can own leads, it falls back to the longest-standing active admin, in a
// fixed order, so the answer never depends on row order.
// ============================================================

export const DEFAULT_LEAD_OWNER_ENV = "DEFAULT_LEAD_OWNER_EMAIL";

/** Roles that can own a sales lead (mirrors ASSIGNABLE_ROLES in lead.actions.ts). */
const OWNER_ROLES = ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"] as const;

const CACHE_MS = 5 * 60 * 1000;
let cached: { id: string; at: number } | null = null;

/** Test hook. */
export function resetDefaultLeadOwnerCache(): void {
  cached = null;
}

export async function getDefaultLeadOwnerId(now: number = Date.now()): Promise<string | null> {
  if (cached && now - cached.at < CACHE_MS) return cached.id;

  let id: string | null = null;
  const email = process.env[DEFAULT_LEAD_OWNER_ENV]?.trim();
  if (email) {
    const named = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        isActive: true,
        role: { in: [...OWNER_ROLES] },
      },
      select: { id: true },
    });
    if (named) id = named.id;
    else console.warn(`[DEFAULT_LEAD_OWNER] ${DEFAULT_LEAD_OWNER_ENV} names no active user who can own leads; using the first admin`);
  }
  if (!id) {
    const admin = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    id = admin?.id ?? null;
  }
  if (id) cached = { id, at: now };
  return id;
}
