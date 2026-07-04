"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}

function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// Approvals are gated on hr:approve (or hr:admin) OR the SUPER_ADMIN / ADMIN roles.
function canApprove(role: string | undefined) {
  if (!role) return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  return hasPermission(role, "hr:approve") || hasPermission(role, "hr:admin");
}

// ============================================================
// Week helpers — weekStart is the Monday (IST) of the given date,
// stored as a @db.Date at UTC midnight to match Prisma's Date type.
// ============================================================
const IST_OFFSET_MIN = 5 * 60 + 30; // +05:30

/** Monday (in IST) of the week containing `iso`, as a UTC-midnight Date for @db.Date. */
function mondayOfWeekUTC(iso: string): Date {
  // Interpret the incoming date at IST, find that day's IST calendar date.
  const base = new Date(iso);
  const istMs = base.getTime() + IST_OFFSET_MIN * 60_000;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  const dow = ist.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (dow + 6) % 7; // days since Monday
  // UTC-midnight of the IST-Monday calendar date (matches @db.Date storage).
  return new Date(Date.UTC(y, m, d - diffToMonday));
}

/** The 7 dates (Mon..Sun) of a week, each UTC-midnight for @db.Date. */
function weekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i))
  );
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function totalHours(entries: { hours: number }[]): number {
  return Math.round(entries.reduce((s, e) => s + (Number.isFinite(e.hours) ? e.hours : 0), 0) * 100) / 100;
}

// ============================================================
// Serialised shapes (Decimal -> number, Date -> ISO string).
// ============================================================
export type TimesheetEntryDTO = { date: string; hours: number; project: string | null; notes: string | null };
export type TimesheetDTO = {
  id: string | null;
  weekStart: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  note: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  entries: TimesheetEntryDTO[];
  totalHours: number;
  editable: boolean;
};

// ============================================================
// My timesheet (read; virtually initialises an empty week)
// ============================================================
export async function getMyTimesheet(weekStartISO: string): Promise<TimesheetDTO | null> {
  const u = await requireUser();
  if (!u?.id) return null;
  if (!can(u.role, "hr:read")) return null;

  const monday = mondayOfWeekUTC(weekStartISO);
  const days = weekDates(monday);

  const ts = await prisma.timesheet.findUnique({
    where: { userId_weekStart: { userId: u.id, weekStart: monday } },
    include: { entries: true },
  });

  const byDate = new Map<string, { hours: number; project: string | null; notes: string | null }>();
  if (ts) {
    for (const e of ts.entries) {
      byDate.set(toISODate(e.date), {
        hours: Number(e.hours),
        project: e.project ?? null,
        notes: e.notes ?? null,
      });
    }
  }

  const entries: TimesheetEntryDTO[] = days.map((d) => {
    const key = toISODate(d);
    const existing = byDate.get(key);
    return { date: key, hours: existing?.hours ?? 0, project: existing?.project ?? null, notes: existing?.notes ?? null };
  });

  const status = (ts?.status as TimesheetDTO["status"]) ?? "DRAFT";
  return {
    id: ts?.id ?? null,
    weekStart: toISODate(monday),
    status,
    note: ts?.note ?? null,
    submittedAt: ts?.submittedAt ? ts.submittedAt.toISOString() : null,
    approvedAt: ts?.approvedAt ? ts.approvedAt.toISOString() : null,
    entries,
    totalHours: totalHours(entries),
    editable: status === "DRAFT" || status === "REJECTED",
  };
}

// ============================================================
// Save (upsert + replace entries) — only DRAFT/REJECTED
// ============================================================
export async function saveTimesheet(
  weekStartISO: string,
  entries: { date: string; hours: number; project?: string | null; notes?: string | null }[],
  note?: string
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!can(u.role, "hr:read")) return { success: false, error: "Not authorized." };

  const monday = mondayOfWeekUTC(weekStartISO);
  const validDays = new Set(weekDates(monday).map(toISODate));

  const existing = await prisma.timesheet.findUnique({
    where: { userId_weekStart: { userId: u.id, weekStart: monday } },
    select: { id: true, status: true },
  });
  if (existing && !(existing.status === "DRAFT" || existing.status === "REJECTED")) {
    return { success: false, error: "This timesheet has been submitted and can no longer be edited." };
  }

  // Sanitise entries: only within the week, non-negative hours, keep rows with hours or content.
  const clean = entries
    .filter((e) => validDays.has(e.date))
    .map((e) => ({
      date: new Date(`${e.date}T00:00:00.000Z`),
      hours: Math.max(0, Math.min(24, Number(e.hours) || 0)),
      project: e.project?.trim() || null,
      notes: e.notes?.trim() || null,
    }))
    .filter((e) => e.hours > 0 || e.project || e.notes);

  const noteVal = note?.trim() || null;

  await prisma.$transaction(async (tx) => {
    const ts = await tx.timesheet.upsert({
      where: { userId_weekStart: { userId: u.id, weekStart: monday } },
      create: { userId: u.id, weekStart: monday, status: "DRAFT", note: noteVal },
      update: { note: noteVal },
    });
    await tx.timesheetEntry.deleteMany({ where: { timesheetId: ts.id } });
    if (clean.length > 0) {
      await tx.timesheetEntry.createMany({
        data: clean.map((e) => ({
          timesheetId: ts.id,
          date: e.date,
          hours: new Prisma.Decimal(e.hours),
          project: e.project,
          notes: e.notes,
        })),
      });
    }
  });

  const saved = await prisma.timesheet.findUnique({
    where: { userId_weekStart: { userId: u.id, weekStart: monday } },
    select: { id: true },
  });
  revalidatePath("/people/timesheets");
  return { success: true, data: { id: saved!.id } };
}

// ============================================================
// Submit — DRAFT/REJECTED -> SUBMITTED
// ============================================================
export async function submitTimesheet(weekStartISO: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!can(u.role, "hr:read")) return { success: false, error: "Not authorized." };

  const monday = mondayOfWeekUTC(weekStartISO);
  const ts = await prisma.timesheet.findUnique({
    where: { userId_weekStart: { userId: u.id, weekStart: monday } },
    include: { entries: true },
  });
  if (!ts) return { success: false, error: "Save the timesheet before submitting." };
  if (!(ts.status === "DRAFT" || ts.status === "REJECTED")) {
    return { success: false, error: "This timesheet is already submitted." };
  }
  if (ts.entries.length === 0) return { success: false, error: "Log at least one hour before submitting." };

  await prisma.timesheet.update({
    where: { id: ts.id },
    data: { status: "SUBMITTED", submittedAt: new Date(), approvedById: null, approvedAt: null },
  });
  revalidatePath("/people/timesheets");
  return { success: true, data: { id: ts.id } };
}

// ============================================================
// Pending approvals (managers) — status SUBMITTED, with owner name.
// userId is a plain ref (no relation), so fetch User names separately.
// ============================================================
export type PendingTimesheetDTO = {
  id: string;
  userId: string;
  ownerName: string;
  weekStart: string;
  submittedAt: string | null;
  totalHours: number;
  note: string | null;
  entries: TimesheetEntryDTO[];
};

export async function getPendingApprovals(): Promise<PendingTimesheetDTO[]> {
  const u = await requireUser();
  if (!canApprove(u?.role)) return [];

  const sheets = await prisma.timesheet.findMany({
    where: { status: "SUBMITTED" },
    include: { entries: true },
    orderBy: { submittedAt: "asc" },
  });
  if (sheets.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(new Set(sheets.map((s) => s.userId))) } },
    select: { id: true, name: true, email: true },
  });
  const nameById = new Map(users.map((x) => [x.id, x.name || x.email || "Unknown"]));

  return sheets.map((s) => {
    const entries: TimesheetEntryDTO[] = s.entries
      .map((e) => ({ date: toISODate(e.date), hours: Number(e.hours), project: e.project ?? null, notes: e.notes ?? null }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return {
      id: s.id,
      userId: s.userId,
      ownerName: nameById.get(s.userId) ?? "Unknown",
      weekStart: toISODate(s.weekStart),
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      totalHours: totalHours(entries),
      note: s.note ?? null,
      entries,
    };
  });
}

// ============================================================
// Approve / Reject (managers only)
// ============================================================
export async function approveTimesheet(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!canApprove(u.role)) return { success: false, error: "Not authorized to approve timesheets." };

  const ts = await prisma.timesheet.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!ts) return { success: false, error: "Timesheet not found." };
  if (ts.status !== "SUBMITTED") return { success: false, error: "Only submitted timesheets can be approved." };

  await prisma.timesheet.update({
    where: { id },
    data: { status: "APPROVED", approvedById: u.id, approvedAt: new Date() },
  });
  revalidatePath("/people/timesheets");
  return { success: true, data: { id } };
}

export async function rejectTimesheet(id: string, reason?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!canApprove(u.role)) return { success: false, error: "Not authorized to reject timesheets." };

  const ts = await prisma.timesheet.findUnique({ where: { id }, select: { id: true, status: true, note: true } });
  if (!ts) return { success: false, error: "Timesheet not found." };
  if (ts.status !== "SUBMITTED") return { success: false, error: "Only submitted timesheets can be rejected." };

  const trimmed = reason?.trim();
  const note = trimmed ? `${ts.note ? ts.note + "\n" : ""}Rejected: ${trimmed}` : ts.note;

  await prisma.timesheet.update({
    where: { id },
    data: { status: "REJECTED", approvedById: u.id, approvedAt: new Date(), note },
  });
  revalidatePath("/people/timesheets");
  return { success: true, data: { id } };
}
