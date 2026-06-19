"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { normalizeMobile } from "@/lib/acq/domain";
import { acqCan, acqHasAnyAccess } from "@/lib/acq/rbac";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}

// ============================================================
// BD lead notes (b) — a timestamped note on the lead's activity timeline.
// ============================================================
export async function addAcqLeadNote(leadId: string, note: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const text = note?.trim();
  if (!text) return { success: false, error: "Note cannot be empty" };

  const lead = await prisma.acqLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
  if (!lead) return { success: false, error: "Lead not found" };

  const a = await prisma.acqLeadActivity.create({
    data: { leadId, channel: "NOTE", note: text, actorId: user.id, actorName: user.name ?? null },
    select: { id: true },
  });
  revalidatePath(`/bd/leads/${leadId}`);
  return { success: true, data: { id: a.id } };
}

// ============================================================
// Site visits / meetings (c) — schedule a future visit/meeting.
// ============================================================
export async function scheduleAcqVisit(input: {
  leadId: string;
  type?: "SITE_VISIT" | "MEETING";
  scheduledAt: string; // ISO
  location?: string;
  agenda?: string;
  assignedToId?: string;
  assignedToName?: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const when = new Date(input.scheduledAt);
  if (isNaN(when.getTime())) return { success: false, error: "Invalid date/time" };

  const lead = await prisma.acqLead.findFirst({ where: { id: input.leadId, deletedAt: null }, select: { id: true } });
  if (!lead) return { success: false, error: "Lead not found" };

  const v = await prisma.acqSiteVisit.create({
    data: {
      leadId: input.leadId,
      type: input.type ?? "SITE_VISIT",
      scheduledAt: when,
      location: input.location?.trim() || null,
      agenda: input.agenda?.trim() || null,
      assignedToId: input.assignedToId || user.id,
      assignedToName: input.assignedToName || user.name || null,
      status: "SCHEDULED",
      createdById: user.id,
      createdByName: user.name ?? null,
    },
    select: { id: true },
  });
  revalidatePath(`/bd/leads/${input.leadId}`);
  return { success: true, data: { id: v.id } };
}

// ============================================================
// Update a site visit / meeting (d) — status + outcome notes after it's done.
// ============================================================
export async function updateAcqVisit(
  id: string,
  patch: {
    status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED";
    outcomeNotes?: string;
    scheduledAt?: string;
    location?: string;
    agenda?: string;
  }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const visit = await prisma.acqSiteVisit.findUnique({ where: { id }, select: { id: true, leadId: true } });
  if (!visit) return { success: false, error: "Visit not found" };

  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    data.status = patch.status;
    data.completedAt = patch.status === "COMPLETED" ? new Date() : null;
  }
  if (patch.outcomeNotes !== undefined) data.outcomeNotes = patch.outcomeNotes.trim() || null;
  if (patch.scheduledAt !== undefined) {
    const when = new Date(patch.scheduledAt);
    if (isNaN(when.getTime())) return { success: false, error: "Invalid date/time" };
    data.scheduledAt = when;
  }
  if (patch.location !== undefined) data.location = patch.location.trim() || null;
  if (patch.agenda !== undefined) data.agenda = patch.agenda.trim() || null;

  await prisma.acqSiteVisit.update({ where: { id }, data });
  revalidatePath(`/bd/leads/${visit.leadId}`);
  return { success: true, data: { id } };
}

export async function getAcqVisits(leadId: string): Promise<Result<unknown[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  const visits = await prisma.acqSiteVisit.findMany({
    where: { leadId },
    orderBy: { scheduledAt: "desc" },
  });
  return { success: true, data: serialize(visits) };
}

// ============================================================
// Owner-by-phone lookup (e/f) — when the same phone is entered, surface the
// existing owner and the venues already on record so the BD rep can add
// another property under the same owner instead of treating it as new.
// ============================================================
export async function getAcqOwnerByPhone(phone: string): Promise<{
  found: boolean;
  ownerName?: string;
  propertyCount?: number;
  properties?: { id: string; propertyName: string; locality: string; status: string }[];
  hallOwner?: { id: string; numberOfHalls: number | null } | null;
}> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { found: false };
  const raw = (phone || "").trim();
  if (raw.replace(/\D/g, "").length < 6) return { found: false };

  const mobile = normalizeMobile(raw);
  const last10 = raw.replace(/\D/g, "").slice(-10);

  const leads = await prisma.acqLead.findMany({
    where: {
      deletedAt: null,
      OR: [{ mobilePrimary: mobile }, { mobilePrimary: { contains: last10 } }],
    },
    select: { id: true, ownerName: true, propertyName: true, locality: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (leads.length === 0) return { found: false };

  const hallOwner = await prisma.hallOwner
    .findFirst({
      where: { OR: [{ phone: { contains: last10 } }, { whatsapp: { contains: last10 } }] },
      select: { id: true, numberOfHalls: true },
    })
    .catch(() => null);

  return {
    found: true,
    ownerName: leads[0].ownerName,
    propertyCount: leads.length,
    properties: leads.map((l) => ({ id: l.id, propertyName: l.propertyName, locality: l.locality, status: l.status })),
    hallOwner,
  };
}
