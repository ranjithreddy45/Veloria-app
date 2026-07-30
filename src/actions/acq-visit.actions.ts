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
// Site visits / meetings / calls (c) — schedule a future touch against either
// a LEAD or a DEAL.
// ============================================================

/** The three kinds of scheduled touch AcqSiteVisit.type carries. */
const VISIT_TYPES = ["SITE_VISIT", "MEETING", "CALL"] as const;
type VisitType = (typeof VISIT_TYPES)[number];

const VISIT_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"] as const;
type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Revalidate whichever detail page owns this entry (lead-scoped or deal-scoped). */
function revalidateVisitScope(v: { leadId: string | null; dealId: string | null }) {
  if (v.leadId) revalidatePath(`/bd/leads/${v.leadId}`);
  if (v.dealId) revalidatePath(`/bd/deals/${v.dealId}`);
  // Scheduled BD work also surfaces on the personal calendar.
  revalidatePath("/calendar");
}

export async function scheduleAcqVisit(input: {
  /** Lead-scoped entry. Exactly one of leadId / dealId must be supplied. */
  leadId?: string;
  /** Deal-scoped entry. Exactly one of leadId / dealId must be supplied. */
  dealId?: string;
  type?: VisitType;
  /** Absolute instant, ISO-8601 WITH a zone (the client converts its
   *  `datetime-local` wall-clock value via `new Date(v).toISOString()`). */
  scheduledAt: string;
  location?: string;
  agenda?: string;
  assignedToId?: string;
  assignedToName?: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  // ---- one-of-two invariant -------------------------------------------------
  // AcqSiteVisit.leadId and .dealId are both nullable because a visit may hang
  // off either side of the funnel, but exactly ONE must be set. Postgres would
  // need a CHECK constraint to express that and `prisma db push` cannot emit
  // one, so this action is the only place the rule can live — reject both-null
  // and both-set here or the table silently accepts orphaned/ambiguous rows.
  const leadId = input.leadId?.trim() || null;
  const dealId = input.dealId?.trim() || null;
  if (leadId && dealId) {
    return { success: false, error: "A schedule entry belongs to either a lead or a deal — not both." };
  }
  if (!leadId && !dealId) {
    return { success: false, error: "A lead or a deal is required to schedule this." };
  }

  const type: VisitType = input.type && VISIT_TYPES.includes(input.type) ? input.type : "SITE_VISIT";

  // The client sends a true instant (ISO with offset/Z). Parsing it here is
  // therefore zone-safe: a bare "2026-08-15T14:30" would be read as UTC by Node
  // on Vercel and shift the appointment by the user's offset (5½h for IST).
  const when = new Date(input.scheduledAt);
  if (isNaN(when.getTime())) return { success: false, error: "Invalid date/time" };

  if (leadId) {
    const lead = await prisma.acqLead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true } });
    if (!lead) return { success: false, error: "Lead not found" };
  } else {
    const deal = await prisma.acqDeal.findFirst({ where: { id: dealId!, deletedAt: null }, select: { id: true } });
    if (!deal) return { success: false, error: "Deal not found" };
  }

  // Resolve the assignee's display name server-side when only an id was passed,
  // so the denormalized assignedToName never drifts from the picked user.
  let assignedToId = input.assignedToId?.trim() || user.id;
  let assignedToName = input.assignedToName?.trim() || null;
  if (!assignedToName) {
    if (assignedToId === user.id) {
      assignedToName = user.name ?? null;
    } else {
      const u = await prisma.user.findUnique({ where: { id: assignedToId }, select: { id: true, name: true } });
      if (!u) {
        // Unknown assignee — fall back to the actor rather than orphaning the row.
        assignedToId = user.id;
        assignedToName = user.name ?? null;
      } else {
        assignedToName = u.name;
      }
    }
  }

  const v = await prisma.acqSiteVisit.create({
    data: {
      leadId,
      dealId,
      type,
      scheduledAt: when,
      location: input.location?.trim() || null,
      agenda: input.agenda?.trim() || null,
      assignedToId,
      assignedToName,
      status: "SCHEDULED",
      createdById: user.id,
      createdByName: user.name ?? null,
    },
    select: { id: true, leadId: true, dealId: true },
  });
  revalidateVisitScope(v);
  return { success: true, data: { id: v.id } };
}

// ============================================================
// Update a site visit / meeting (d) — status + outcome notes after it's done.
// ============================================================
export async function updateAcqVisit(
  id: string,
  patch: {
    status?: VisitStatus;
    /** The single running SUMMARY field. Kept alongside the appendable
     *  AcqVisitNote thread — the two are complementary, not duplicates. */
    outcomeNotes?: string;
    /** Absolute instant, ISO-8601 WITH a zone — see scheduleAcqVisit. */
    scheduledAt?: string;
    location?: string;
    agenda?: string;
    type?: VisitType;
    assignedToId?: string;
  }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };

  const visit = await prisma.acqSiteVisit.findUnique({
    where: { id },
    select: { id: true, leadId: true, dealId: true },
  });
  if (!visit) return { success: false, error: "Visit not found" };

  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    if (!VISIT_STATUSES.includes(patch.status)) return { success: false, error: "Invalid status" };
    data.status = patch.status;
    data.completedAt = patch.status === "COMPLETED" ? new Date() : null;
  }
  if (patch.outcomeNotes !== undefined) data.outcomeNotes = patch.outcomeNotes.trim() || null;
  if (patch.scheduledAt !== undefined) {
    // Already a true instant from the client (`new Date(localValue).toISOString()`),
    // so no zone guessing happens here.
    const when = new Date(patch.scheduledAt);
    if (isNaN(when.getTime())) return { success: false, error: "Invalid date/time" };
    data.scheduledAt = when;
  }
  if (patch.location !== undefined) data.location = patch.location.trim() || null;
  if (patch.agenda !== undefined) data.agenda = patch.agenda.trim() || null;
  if (patch.type !== undefined) {
    if (!VISIT_TYPES.includes(patch.type)) return { success: false, error: "Invalid type" };
    data.type = patch.type;
  }
  if (patch.assignedToId !== undefined && patch.assignedToId) {
    const u = await prisma.user.findUnique({ where: { id: patch.assignedToId }, select: { id: true, name: true } });
    if (!u) return { success: false, error: "Assignee not found" };
    data.assignedToId = u.id;
    data.assignedToName = u.name;
  }

  await prisma.acqSiteVisit.update({ where: { id }, data });
  revalidateVisitScope(visit);
  return { success: true, data: { id } };
}

/** Delete a schedule entry (its note thread cascades). */
export async function deleteAcqVisit(id: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const visit = await prisma.acqSiteVisit.findUnique({
    where: { id },
    select: { id: true, leadId: true, dealId: true },
  });
  if (!visit) return { success: false, error: "Visit not found" };
  await prisma.acqSiteVisit.delete({ where: { id } });
  revalidateVisitScope(visit);
  return { success: true, data: { id } };
}

// Legacy lead-scoped reader — kept so the existing lead visits panel keeps
// working unchanged. New callers should use getAcqSchedule().
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
// Schedule reader (item 8/13) — one shape for both scopes, newest-first, with
// the appendable note thread attached.
// ============================================================
export interface AcqScheduleNoteDTO {
  id: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  editedAt: string | null;
}

export interface AcqScheduleEntryDTO {
  id: string;
  type: string; // SITE_VISIT | MEETING | CALL
  status: string; // SCHEDULED | COMPLETED | CANCELLED | NO_SHOW | RESCHEDULED
  /** Absolute instant, ISO-8601 with a zone — the client renders it in local time. */
  scheduledAt: string;
  location: string | null;
  agenda: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  outcomeNotes: string | null;
  completedAt: string | null;
  createdByName: string | null;
  createdAt: string;
  notes: AcqScheduleNoteDTO[];
}

export async function getAcqSchedule(
  scope: "lead" | "deal",
  id: string
): Promise<Result<AcqScheduleEntryDTO[]>> {
  const user = await requireUser();
  if (!user || !acqHasAnyAccess(user.role)) return { success: false, error: "Unauthorized" };
  if (scope !== "lead" && scope !== "deal") return { success: false, error: "Invalid scope" };
  if (!id) return { success: false, error: "Missing id" };

  const rows = await prisma.acqSiteVisit.findMany({
    where: scope === "lead" ? { leadId: id } : { dealId: id },
    orderBy: { scheduledAt: "desc" }, // newest first
    include: { visitNotes: { orderBy: { createdAt: "asc" } } },
    take: 200,
  });

  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      scheduledAt: r.scheduledAt.toISOString(),
      location: r.location,
      agenda: r.agenda,
      assignedToId: r.assignedToId,
      assignedToName: r.assignedToName,
      outcomeNotes: r.outcomeNotes,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      createdByName: r.createdByName,
      createdAt: r.createdAt.toISOString(),
      notes: r.visitNotes.map((n) => ({
        id: n.id,
        body: n.body,
        authorId: n.authorId,
        authorName: n.authorName,
        createdAt: n.createdAt.toISOString(),
        editedAt: n.editedAt ? n.editedAt.toISOString() : null,
      })),
    })),
  };
}

// ============================================================
// Item 8 — appendable, timestamped note thread per schedule entry.
// Several touches get recorded over time, so a note is APPENDED (never
// overwriting the previous one); `outcomeNotes` remains the one-line summary.
// ============================================================
export async function addAcqVisitNote(visitId: string, body: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const text = (body ?? "").trim();
  if (!text) return { success: false, error: "Note cannot be empty" };
  if (text.length > 5000) return { success: false, error: "Note is too long (max 5000 characters)." };

  const visit = await prisma.acqSiteVisit.findUnique({
    where: { id: visitId },
    select: { id: true, leadId: true, dealId: true },
  });
  if (!visit) return { success: false, error: "Visit not found" };

  const n = await prisma.acqVisitNote.create({
    data: { visitId, body: text, authorId: user.id, authorName: user.name ?? null },
    select: { id: true },
  });
  revalidateVisitScope(visit);
  return { success: true, data: { id: n.id } };
}

export async function updateAcqVisitNote(noteId: string, body: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const text = (body ?? "").trim();
  if (!text) return { success: false, error: "Note cannot be empty" };
  if (text.length > 5000) return { success: false, error: "Note is too long (max 5000 characters)." };

  const note = await prisma.acqVisitNote.findUnique({
    where: { id: noteId },
    select: { id: true, body: true, visit: { select: { leadId: true, dealId: true } } },
  });
  if (!note) return { success: false, error: "Note not found" };
  if (note.body === text) return { success: true, data: { id: noteId } }; // no-op, don't stamp editedAt

  // editedAt is what the UI shows as "edited …" — only stamp it on a real change
  // so the thread stays an honest record of when each touch was written.
  await prisma.acqVisitNote.update({ where: { id: noteId }, data: { body: text, editedAt: new Date() } });
  revalidateVisitScope(note.visit);
  return { success: true, data: { id: noteId } };
}

export async function deleteAcqVisitNote(noteId: string): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user || !acqCan(user.role, "lead:write")) return { success: false, error: "Unauthorized" };
  const note = await prisma.acqVisitNote.findUnique({
    where: { id: noteId },
    select: { id: true, visit: { select: { leadId: true, dealId: true } } },
  });
  if (!note) return { success: false, error: "Note not found" };
  await prisma.acqVisitNote.delete({ where: { id: noteId } });
  revalidateVisitScope(note.visit);
  return { success: true, data: { id: noteId } };
}

// ============================================================
// Item 13 — feed BD schedule entries into the employee calendar.
// ------------------------------------------------------------
// The personal calendar (/calendar) is driven by getMyCalendarTasks() in
// crm-task.actions.ts, which reads Sales `Task` rows. BD visits/meetings/calls
// live in a different table, so this exposes them in a shape the calendar can
// merge without any BD knowledge: field-for-field compatible with the Sales
// CalendarTaskDTO (id/title/taskType/status/dueDate/isOverdue) plus a `source`
// discriminator and a ready-made `href` for the "open record" link.
//   • taskType maps SITE_VISIT → SHOW_AROUND so the existing calendar's icon /
//     colour table renders BD site visits without a UI change.
//   • status maps COMPLETED → DONE (the calendar's done sentinel); everything
//     else stays PENDING except CANCELLED, which reads as CANCELLED and is not
//     treated as overdue.
// ============================================================
export interface AcqCalendarEntryDTO {
  id: string;
  title: string;
  taskType: string; // FOLLOW_UP | CALL | MEETING | SHOW_AROUND | TASK (calendar vocabulary)
  status: string; // PENDING | DONE | CANCELLED
  dueDate: string; // ISO instant
  /** Always null. A BD lead id must NOT be exposed here: the Sales calendar
   *  renders `leadId` as a link to /leads/<id>, which is a different table —
   *  it would 404. Use `href` (BD route) instead. */
  leadId: null;
  inquiryId: null;
  contactId: null;
  isOverdue: boolean;
  /** Discriminator so a merged calendar can route actions to the right module. */
  source: "BD_VISIT";
  /** BD detail page for this entry (lead or deal). */
  href: string;
  /** Raw BD ids, for a calendar that wants to deep-link properly. */
  bdLeadId: string | null;
  bdDealId: string | null;
  visitType: string; // the raw AcqSiteVisit.type
  visitStatus: string; // the raw AcqSiteVisit.status
  location: string | null;
}

const CALENDAR_TASK_TYPE: Record<string, string> = {
  SITE_VISIT: "SHOW_AROUND",
  MEETING: "MEETING",
  CALL: "CALL",
};

export async function listAcqVisitsForCalendar(input: {
  /** Defaults to the signed-in user. Only a manager may read someone else's. */
  userId?: string;
  from: string; // ISO instant
  to: string; // ISO instant
}): Promise<Result<AcqCalendarEntryDTO[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  // Own calendar needs no BD permission (a BD entry may be assigned to anyone);
  // reading another user's schedule is a manager action.
  const targetId = input.userId?.trim() || user.id;
  if (targetId !== user.id && !acqCan(user.role, "lead:reassign")) {
    return { success: false, error: "Only a BD Head / manager can view another user's schedule." };
  }

  const from = new Date(input.from);
  const to = new Date(input.to);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return { success: false, error: "Invalid range" };

  const rows = await prisma.acqSiteVisit.findMany({
    where: { assignedToId: targetId, scheduledAt: { gte: from, lte: to } },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true, type: true, status: true, scheduledAt: true, location: true,
      agenda: true, leadId: true, dealId: true,
      lead: { select: { propertyName: true, ownerName: true } },
      deal: { select: { name: true, propertyName: true } },
    },
    take: 500,
  });

  const now = Date.now();
  const TYPE_LABEL: Record<string, string> = { SITE_VISIT: "Site visit", MEETING: "Meeting", CALL: "Call" };

  return {
    success: true,
    data: rows.map((r) => {
      const subject = r.deal?.propertyName || r.deal?.name || r.lead?.propertyName || r.lead?.ownerName || "BD record";
      const done = r.status === "COMPLETED";
      const cancelled = r.status === "CANCELLED";
      return {
        id: r.id,
        title: `BD ${TYPE_LABEL[r.type] ?? "visit"} — ${subject}`,
        taskType: CALENDAR_TASK_TYPE[r.type] ?? "TASK",
        status: done ? "DONE" : cancelled ? "CANCELLED" : "PENDING",
        dueDate: r.scheduledAt.toISOString(),
        leadId: null,
        inquiryId: null,
        contactId: null,
        isOverdue: !done && !cancelled && r.scheduledAt.getTime() < now,
        source: "BD_VISIT" as const,
        href: r.dealId ? `/bd/deals/${r.dealId}` : r.leadId ? `/bd/leads/${r.leadId}` : "/bd",
        bdLeadId: r.leadId,
        bdDealId: r.dealId,
        visitType: r.type,
        visitStatus: r.status,
        location: r.location,
      };
    }),
  };
}

/** Calendar-side "mark done" for a BD schedule entry (mirrors updateCrmTaskStatus). */
export async function markAcqVisitDone(visitId: string): Promise<Result<{ id: string }>> {
  return updateAcqVisit(visitId, { status: "COMPLETED" });
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
