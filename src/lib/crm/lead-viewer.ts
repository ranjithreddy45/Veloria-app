import { prisma } from "@/lib/prisma";
import type { LeadViewer } from "./lead-filters";

/**
 * The signed-in user as a lead viewer, with their sales team (not carried in
 * the session — a team change applies on the next request, not the next login).
 */
export async function leadViewer(user: { id?: string | null; role?: string | null }): Promise<LeadViewer> {
  const id = String(user.id ?? "");
  const row = id ? await prisma.user.findUnique({ where: { id }, select: { salesTeam: true } }) : null;
  return { id, role: String(user.role ?? ""), salesTeam: row?.salesTeam ?? null };
}
