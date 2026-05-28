"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { serialize } from "@/lib/utils";

export interface TrashItem {
  id: string;
  type: "lead" | "contact";
  title: string;
  subtitle: string;
  deletedAt: Date;
  daysLeft: number;
}

const RETENTION_DAYS = 30;

/**
 * List soft-deleted leads and contacts, ordered by most recently deleted.
 * Each item carries a `daysLeft` countdown to the automatic purge.
 */
export async function getTrash(): Promise<{
  success: boolean;
  data?: TrashItem[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    if (!hasPermission(session.user.role as string, "leads:delete")) {
      return { success: false, error: "Insufficient permissions" };
    }

    const [leads, contacts] = await Promise.all([
      prisma.lead.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          title: true,
          deletedAt: true,
          contact: { select: { firstName: true, lastName: true } },
        },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.contact.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          company: true,
          deletedAt: true,
        },
        orderBy: { deletedAt: "desc" },
      }),
    ]);

    const now = Date.now();
    const ms = 1000 * 60 * 60 * 24;

    const items: TrashItem[] = [
      ...leads.map((l): TrashItem => {
        const deletedAt = l.deletedAt as Date;
        const ageDays = Math.floor((now - deletedAt.getTime()) / ms);
        return {
          id: l.id,
          type: "lead",
          title: l.title,
          subtitle: `${l.contact.firstName} ${l.contact.lastName}`.trim(),
          deletedAt,
          daysLeft: Math.max(0, RETENTION_DAYS - ageDays),
        };
      }),
      ...contacts.map((c): TrashItem => {
        const deletedAt = c.deletedAt as Date;
        const ageDays = Math.floor((now - deletedAt.getTime()) / ms);
        return {
          id: c.id,
          type: "contact",
          title: `${c.firstName} ${c.lastName}`.trim(),
          subtitle: c.company ?? c.email ?? "",
          deletedAt,
          daysLeft: Math.max(0, RETENTION_DAYS - ageDays),
        };
      }),
    ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

    return { success: true, data: serialize(items) as TrashItem[] };
  } catch (error) {
    console.error("[GET_TRASH_ERROR]", error);
    return { success: false, error: "Failed to load trash" };
  }
}

/**
 * Permanently purge soft-deleted records older than RETENTION_DAYS.
 * Wire this to a cron — see `src/app/api/cron/trash-purge/route.ts`.
 */
export async function purgeOldTrash(): Promise<{
  leadsPurged: number;
  contactsPurged: number;
}> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [leadsResult, contactsResult] = await Promise.all([
    prisma.lead.deleteMany({
      where: { deletedAt: { not: null, lt: cutoff } },
    }),
    prisma.contact.deleteMany({
      where: { deletedAt: { not: null, lt: cutoff } },
    }),
  ]);

  return {
    leadsPurged: leadsResult.count,
    contactsPurged: contactsResult.count,
  };
}
