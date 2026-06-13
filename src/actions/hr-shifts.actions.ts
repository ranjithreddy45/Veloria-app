"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { dateKey } from "@/lib/hr/leave-calc";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}
async function myEmployee(userId: string) {
  return prisma.employee.findFirst({ where: { userId, deletedAt: null }, select: { id: true } });
}
const utcDate = (iso: string) => new Date(iso + "T00:00:00.000Z");

// ============================================================
// Shift types (admin)
// ============================================================
export async function listShifts(activeOnly = true) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.hrShift.findMany({ where: activeOnly ? { isActive: true } : undefined, orderBy: [{ order: "asc" }, { startTime: "asc" }] });
}

export async function upsertShift(input: { id?: string; name: string; startTime: string; endTime: string; color?: string; isActive?: boolean }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!input.name?.trim() || !input.startTime || !input.endTime) return { success: false, error: "Name and times are required." };
  const data = { name: input.name.trim(), startTime: input.startTime, endTime: input.endTime, color: input.color || "blue", isActive: input.isActive ?? true };
  const rec = input.id ? await prisma.hrShift.update({ where: { id: input.id }, data }) : await prisma.hrShift.create({ data });
  revalidatePath("/people/shifts");
  return { success: true, data: { id: rec.id } };
}

// ============================================================
// Roster (assign shifts)
// ============================================================
export async function assignShift(employeeId: string, shiftId: string, date: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const d = utcDate(date);
  const rec = await prisma.shiftAssignment.upsert({
    where: { employeeId_date: { employeeId, date: d } },
    create: { employeeId, shiftId, date: d },
    update: { shiftId },
  });
  revalidatePath("/people/shifts");
  return { success: true, data: { id: rec.id } };
}

export async function removeAssignment(employeeId: string, date: string): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  await prisma.shiftAssignment.deleteMany({ where: { employeeId, date: utcDate(date) } });
  revalidatePath("/people/shifts");
  return { success: true, data: { ok: true } };
}

// Assign one shift to an employee across a date range (optionally skip weekends).
export async function assignRange(input: { employeeId: string; shiftId: string; startDate: string; endDate: string; skipWeekends?: boolean }): Promise<Result<{ count: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const s = utcDate(input.startDate), e = utcDate(input.endDate);
  if (e < s) return { success: false, error: "End before start." };
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getUTCDay();
    if (!(input.skipWeekends && (day === 0 || day === 6))) {
      await prisma.shiftAssignment.upsert({
        where: { employeeId_date: { employeeId: input.employeeId, date: new Date(cur) } },
        create: { employeeId: input.employeeId, shiftId: input.shiftId, date: new Date(cur) },
        update: { shiftId: input.shiftId },
      });
      count++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  revalidatePath("/people/shifts");
  return { success: true, data: { count } };
}

// Roster grid for a week starting Monday (weekStart = ISO date of the Monday).
export async function getRoster(weekStartIso: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { employees: [], assignments: [], shifts: [] };
  const start = utcDate(weekStartIso);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);

  const [employees, assignments, shifts] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      select: { id: true, firstName: true, lastName: true, empCode: true, department: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }],
      take: 100,
    }),
    prisma.shiftAssignment.findMany({
      where: { date: { gte: start, lte: end } },
      include: { shift: { select: { name: true, color: true, startTime: true, endTime: true } } },
    }),
    prisma.hrShift.findMany({ where: { isActive: true }, orderBy: { order: "asc" } }),
  ]);
  return {
    employees,
    shifts,
    assignments: assignments.map((a) => ({ id: a.id, employeeId: a.employeeId, dateKey: dateKey(a.date), shiftId: a.shiftId, shift: a.shift })),
  };
}

// ============================================================
// My shifts + swaps
// ============================================================
export async function getMyShifts() {
  const u = await requireUser();
  if (!u?.id) return null;
  const me = await myEmployee(u.id);
  if (!me) return { linked: false as const };
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const upcoming = await prisma.shiftAssignment.findMany({
    where: { employeeId: me.id, date: { gte: from } },
    include: { shift: true },
    orderBy: { date: "asc" },
    take: 30,
  });
  return { linked: true as const, employeeId: me.id, upcoming };
}

export async function requestShiftSwap(assignmentId: string, targetEmployeeId: string, reason?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  if (!me) return { success: false, error: "No employee record." };
  const assignment = await prisma.shiftAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) return { success: false, error: "Assignment not found." };
  if (assignment.employeeId !== me.id && !can(u.role, "hr:write")) return { success: false, error: "You can only swap your own shifts." };
  if (targetEmployeeId === assignment.employeeId) return { success: false, error: "Pick a different colleague." };

  const req = await prisma.shiftSwapRequest.create({
    data: { assignmentId, requestedById: assignment.employeeId, targetEmployeeId, reason: reason?.trim() || null },
  });
  revalidatePath("/people/shifts");
  return { success: true, data: { id: req.id } };
}

export async function getSwapQueue() {
  const u = await requireUser();
  if (!u?.id) return { rows: [] };
  const me = await myEmployee(u.id);
  const isHr = can(u.role, "hr:approve");
  const where = isHr ? { status: "PENDING" as const } : me ? { status: "PENDING" as const, targetEmployeeId: me.id } : { id: "__none__" };
  const rows = await prisma.shiftSwapRequest.findMany({
    where,
    include: {
      assignment: { include: { shift: { select: { name: true } } } },
      requestedBy: { select: { firstName: true, lastName: true, empCode: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return { rows: rows.map((r) => ({ id: r.id, reason: r.reason, dateKey: dateKey(r.assignment.date), shiftName: r.assignment.shift.name, requester: r.requestedBy })) };
}

export async function decideShiftSwap(id: string, decision: "APPROVED" | "REJECTED"): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  const isHr = can(u.role, "hr:approve");

  const req = await prisma.shiftSwapRequest.findUnique({ where: { id }, include: { assignment: true } });
  if (!req || req.status !== "PENDING") return { success: false, error: "Not found or already decided." };
  if (!isHr && !(me && req.targetEmployeeId === me.id)) return { success: false, error: "Only the requested colleague (or HR) can decide." };

  try {
    await prisma.$transaction(async (tx) => {
      if (decision === "APPROVED") {
        // Target takes over the shift on that date — only if they're free that day.
        const clash = await tx.shiftAssignment.findUnique({
          where: { employeeId_date: { employeeId: req.targetEmployeeId, date: req.assignment.date } },
        });
        if (clash) throw new Error("CLASH");
        await tx.shiftAssignment.update({ where: { id: req.assignmentId }, data: { employeeId: req.targetEmployeeId } });
      }
      await tx.shiftSwapRequest.update({ where: { id }, data: { status: decision, decidedAt: new Date() } });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "CLASH") return { success: false, error: "That colleague already has a shift on this date." };
    return { success: false, error: "Could not process the swap." };
  }

  revalidatePath("/people/shifts");
  return { success: true, data: { id } };
}
