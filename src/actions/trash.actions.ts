"use server";

import { auth } from "@/../auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { isValidCronSecret } from "@/lib/cron-auth";

/**
 * Authorize a caller for the destructive trash-purge operation. As a top-level
 * export of a "use server" module, purgeOldTrash is independently dispatchable
 * by any client, so it must enforce its own gate rather than trust the cron
 * route. Allow either the trusted cron path (a valid CRON_SECRET on the
 * in-process request) or an authenticated session with leads:delete (same gate
 * as the sibling getTrash). Using the request authorization header keeps the
 * existing no-arg cron call working without changing its call site.
 */
async function authorizePurge(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const h = await headers();
    if (isValidCronSecret(h.get("authorization"))) {
      return { ok: true };
    }
  } catch {
    // headers() can throw outside a request scope — fall through to session auth.
  }
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasPermission(session.user.role as string, "leads:delete")) {
    return { ok: false, error: "Insufficient permissions" };
  }
  return { ok: true };
}

export interface TrashItem {
  id: string;
  type: "lead" | "contact";
  title: string;
  subtitle: string;
  /** ISO string — safe to pass across the server/client boundary. */
  deletedAt: string;
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
          deletedAt: deletedAt.toISOString(),
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
          deletedAt: deletedAt.toISOString(),
          daysLeft: Math.max(0, RETENTION_DAYS - ageDays),
        };
      }),
    ].sort(
      (a, b) =>
        new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
    );

    return { success: true, data: items };
  } catch (error) {
    console.error("[GET_TRASH_ERROR]", error);
    return { success: false, error: "Failed to load trash" };
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Permanently purge soft-deleted records older than RETENTION_DAYS.
 * Wire this to a cron — see `src/app/api/cron/trash-purge/route.ts`.
 *
 * Leads — every relation to Lead in prisma/schema.prisma falls into one of:
 *  - Business records (Deal, Quote, SalesQuotation; no onDelete, so the FK
 *    restricts): never destroyed. The lead stays in trash and is counted in
 *    `skipped`. Logged once — on the run where it first crosses the retention
 *    window — not on every daily run.
 *  - Pure child data with a restricting FK (LeadAttribution,
 *    LeadFirstResponse): deleted explicitly, in the same transaction as the
 *    lead, so a failed lead delete rolls them back.
 *  - Already handled by the schema: ConversionExportLog, LeadExternalRef and
 *    LeadTouch cascade; MetaLeadCapture is set null.
 * Every statement in the transaction is re-scoped to "still in trash and past
 * the cutoff", so a lead restored mid-run keeps its attribution and survives.
 * Plain `leadId` string columns (no FK — Task, CrmNote, routing/SLA logs…)
 * cannot block the delete and are deliberately left as they are.
 *
 * Contacts with leads/bookings/invoices are likewise left in trash.
 *
 * AUTH: this is a top-level "use server" export, so it is independently
 * dispatchable by any client and MUST gate itself. The cron route is trusted
 * via its CRON_SECRET request header; interactive callers are authorized via
 * session + leads:delete.
 */
export async function purgeOldTrash(): Promise<{
  leadsPurged: number;
  contactsPurged: number;
  skipped: number;
  error?: string;
}> {
  const authz = await authorizePurge();
  if (!authz.ok) {
    return { leadsPurged: 0, contactsPurged: 0, skipped: 0, error: authz.error };
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  let leadsPurged = 0;
  let contactsPurged = 0;
  let skipped = 0;

  const oldLeads = await prisma.lead.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: {
      id: true,
      deletedAt: true,
      deal: { select: { id: true } },
      quotes: { select: { id: true }, take: 1 },
      salesQuotations: { select: { id: true }, take: 1 },
    },
  });
  const newlyKept: string[] = [];
  for (const lead of oldLeads) {
    if (lead.deal || lead.quotes.length > 0 || lead.salesQuotations.length > 0) {
      skipped++;
      // Crossed the cutoff within the last day → first run to see it.
      if (lead.deletedAt && lead.deletedAt.getTime() >= cutoff.getTime() - DAY_MS) {
        newlyKept.push(lead.id);
      }
      continue;
    }
    try {
      const stillInTrash = { deletedAt: { not: null, lt: cutoff } };
      const [, , removed] = await prisma.$transaction([
        prisma.leadAttribution.deleteMany({
          where: { leadId: lead.id, lead: stillInTrash },
        }),
        prisma.leadFirstResponse.deleteMany({
          where: { leadId: lead.id, lead: stillInTrash },
        }),
        prisma.lead.deleteMany({ where: { id: lead.id, ...stillInTrash } }),
      ]);
      if (removed.count > 0) leadsPurged++;
    } catch (e) {
      console.error(`[purgeOldTrash] Failed to purge lead ${lead.id}:`, e);
      skipped++;
    }
  }
  if (newlyKept.length > 0) {
    console.info(
      `[purgeOldTrash] Keeping ${newlyKept.length} lead(s) in trash past ${RETENTION_DAYS} days — they have a deal or quote: ${newlyKept.join(", ")}`
    );
  }

  // Contacts — skip any with leads/bookings/invoices
  const oldContacts = await prisma.contact.findMany({
    where: { deletedAt: { not: null, lt: cutoff } },
    select: {
      id: true,
      _count: { select: { leads: true, bookings: true, invoices: true } },
    },
  });
  for (const contact of oldContacts) {
    if (
      contact._count.leads > 0 ||
      contact._count.bookings > 0 ||
      contact._count.invoices > 0
    ) {
      skipped++;
      continue;
    }
    try {
      await prisma.contact.delete({ where: { id: contact.id } });
      contactsPurged++;
    } catch (e) {
      console.error(`[purgeOldTrash] Failed to purge contact ${contact.id}:`, e);
      skipped++;
    }
  }

  return { leadsPurged, contactsPurged, skipped };
}
