"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { LEAVE_TYPE_SEED, HOLIDAY_SEED_2026 } from "@/lib/hr/constants";
import { workingDays, rangesOverlap, dateKey, type HalfDayPart } from "@/lib/hr/leave-calc";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// Resolve the Employee record for the signed-in user (self-service).
async function myEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, reportingManagerId: true, legalEntityId: true },
  });
}

const currentYear = () => new Date().getUTCFullYear();

// ============================================================
// Setup (admin): default leave types + holidays. Idempotent.
// ============================================================
export async function seedLeaveSetup(): Promise<Result<{ types: number; holidays: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  let types = 0, holidays = 0;
  for (const t of LEAVE_TYPE_SEED) {
    const exists = await prisma.leaveType.findUnique({ where: { code: t.code } });
    if (!exists) { await prisma.leaveType.create({ data: t }); types++; }
  }
  const yr = 2026;
  for (const h of HOLIDAY_SEED_2026) {
    const date = new Date(h.date + "T00:00:00.000Z");
    const exists = await prisma.holiday.findFirst({ where: { date, name: h.name } });
    if (!exists) { await prisma.holiday.create({ data: { date, name: h.name, year: yr } }); holidays++; }
  }
  revalidatePath("/people/leave");
  return { success: true, data: { types, holidays } };
}

export async function getLeaveTypes(activeOnly = true) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.leaveType.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export async function getHolidays(year = currentYear()) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.holiday.findMany({ where: { year }, orderBy: { date: "asc" } });
}

async function holidayKeySet(year: number): Promise<Set<string>> {
  const hols = await prisma.holiday.findMany({ where: { year }, select: { date: true } });
  return new Set(hols.map((h) => dateKey(h.date)));
}

// Ensure balance rows exist for an employee for a year (seeds from accrual).
async function ensureBalances(employeeId: string, year: number) {
  const types = await prisma.leaveType.findMany({ where: { isActive: true } });
  for (const t of types) {
    const exists = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: t.id, year } },
    });
    if (!exists) {
      await prisma.leaveBalance.create({
        data: { employeeId, leaveTypeId: t.id, year, entitled: t.accrualPerYear },
      });
    }
  }
}

// ============================================================
// Self-service dashboard: my balances + my requests
// ============================================================
export async function getMyLeaveDashboard(year = currentYear()) {
  const u = await requireUser();
  if (!u?.id) return null;
  const emp = await myEmployee(u.id);
  if (!emp) return { linked: false as const };

  await ensureBalances(emp.id, year);
  const [balances, requests] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { employeeId: emp.id, year },
      include: { leaveType: true },
      orderBy: { leaveType: { order: "asc" } },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId: emp.id },
      include: { leaveType: { select: { name: true, code: true, color: true } }, approver: { select: { firstName: true, lastName: true } } },
      orderBy: { startDate: "desc" },
      take: 50,
    }),
  ]);
  return { linked: true as const, employeeId: emp.id, balances, requests };
}

// ============================================================
// Apply for leave
// ============================================================
export interface ApplyLeaveInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startPart?: HalfDayPart;
  endPart?: HalfDayPart;
  reason?: string;
  /** HR can apply on behalf of an employee. */
  employeeId?: string;
}

export async function applyLeave(input: ApplyLeaveInput): Promise<Result<{ id: string; days: number }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  // Determine target employee.
  let employeeId = input.employeeId;
  if (employeeId) {
    if (!can(u.role, "hr:write")) return { success: false, error: "Not authorized to apply on behalf of others." };
  } else {
    const emp = await myEmployee(u.id);
    if (!emp) return { success: false, error: "Your account isn't linked to an employee record yet." };
    employeeId = emp.id;
  }

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true, reportingManagerId: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  const type = await prisma.leaveType.findUnique({ where: { id: input.leaveTypeId } });
  if (!type || !type.isActive) return { success: false, error: "Invalid leave type." };

  const start = new Date(input.startDate + "T00:00:00.000Z");
  const end = new Date(input.endDate + "T00:00:00.000Z");
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false, error: "Invalid dates." };
  if (end < start) return { success: false, error: "End date can't be before start date." };

  const startPart = (type.allowHalfDay ? input.startPart : "FULL") ?? "FULL";
  const endPart = (type.allowHalfDay ? input.endPart : "FULL") ?? "FULL";

  const year = start.getUTCFullYear();
  const holidays = await holidayKeySet(year);
  const days = workingDays(start, end, startPart, endPart, holidays);
  if (days <= 0) return { success: false, error: "The selected dates are all weekends/holidays — no working days to apply." };

  // Overlap guard against existing pending/approved requests.
  const existing = await prisma.leaveRequest.findMany({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] } },
    select: { startDate: true, endDate: true },
  });
  if (existing.some((e) => rangesOverlap(start, end, e.startDate, e.endDate)))
    return { success: false, error: "You already have a leave request overlapping these dates." };

  await ensureBalances(employeeId, year);

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Balance check (unless the type allows negative, e.g. LOP).
      if (!type.allowNegative) {
        const bal = await tx.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_year: { employeeId: employeeId!, leaveTypeId: type.id, year } },
        });
        const available = (bal?.entitled ?? 0) + (bal?.carriedForward ?? 0) - (bal?.used ?? 0) - (bal?.pending ?? 0);
        if (days > available + 1e-9)
          throw new Error(`Insufficient ${type.code} balance: ${available} day(s) available, ${days} requested.`);
      }

      const req = await tx.leaveRequest.create({
        data: {
          employeeId: employeeId!,
          leaveTypeId: type.id,
          startDate: start,
          endDate: end,
          startPart: startPart as Prisma.LeaveRequestCreateInput["startPart"],
          endPart: endPart as Prisma.LeaveRequestCreateInput["endPart"],
          days,
          reason: input.reason?.trim() || null,
          status: type.requiresApproval ? "PENDING" : "APPROVED",
          approverId: emp.reportingManagerId,
          decidedAt: type.requiresApproval ? null : new Date(),
        },
      });

      // Reserve the balance (pending) — or directly used if auto-approved.
      await tx.leaveBalance.update({
        where: { employeeId_leaveTypeId_year: { employeeId: employeeId!, leaveTypeId: type.id, year } },
        data: type.requiresApproval ? { pending: { increment: days } } : { used: { increment: days } },
      });

      await tx.activityLog.create({
        data: { action: "LEAVE_APPLIED", entityType: "LEAVE_REQUEST", entityId: req.id, userId: u.id, changes: { type: type.code, days } },
      });
      return req;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/people/leave");
    revalidatePath("/people/leave/approvals");
    return { success: true, data: { id: created.id, days } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not apply for leave." };
  }
}

// ============================================================
// Approval queue + decide
// ============================================================
export async function getLeaveApprovalQueue() {
  const u = await requireUser();
  if (!u?.id) return { canApproveAll: false, rows: [] };

  const isHrApprover = can(u.role, "hr:approve");
  const me = await myEmployee(u.id);

  // HR approvers see all pending; managers see requests routed to them.
  const where: Prisma.LeaveRequestWhereInput = isHrApprover
    ? { status: "PENDING" }
    : me
      ? { status: "PENDING", approverId: me.id }
      : { id: "__none__" };

  const rows = await prisma.leaveRequest.findMany({
    where,
    include: {
      leaveType: { select: { name: true, code: true, color: true } },
      employee: { select: { id: true, firstName: true, lastName: true, empCode: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return { canApproveAll: isHrApprover, rows };
}

export async function decideLeave(requestId: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  const req = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!req || req.status !== "PENDING") return { success: false, error: "Request not found or already decided." };

  // Authorisation: HR approver, or the routed manager (their employee id matches approverId).
  const isHrApprover = can(u.role, "hr:approve");
  const me = await myEmployee(u.id);
  const isRoutedManager = me && req.approverId === me.id;
  if (!isHrApprover && !isRoutedManager) return { success: false, error: "You're not the approver for this request." };

  const year = req.startDate.getUTCFullYear();

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: decision, decidedAt: new Date(), decisionNote: note || null, approverId: me?.id ?? req.approverId },
    });
    // Move the reserved pending balance.
    const bal = await tx.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year } },
    });
    if (bal) {
      if (decision === "APPROVED") {
        await tx.leaveBalance.update({
          where: { id: bal.id },
          data: { pending: { decrement: req.days }, used: { increment: req.days } },
        });
      } else {
        await tx.leaveBalance.update({ where: { id: bal.id }, data: { pending: { decrement: req.days } } });
      }
    }
    await tx.activityLog.create({
      data: {
        action: decision === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        entityType: "LEAVE_REQUEST", entityId: requestId, userId: u.id, changes: { days: req.days },
      },
    });
  });

  revalidatePath("/people/leave");
  revalidatePath("/people/leave/approvals");
  return { success: true, data: { id: requestId } };
}

// Cancel own pending request (releases the reserved balance).
export async function cancelLeave(requestId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);

  const req = await prisma.leaveRequest.findUnique({ where: { id: requestId } });
  if (!req) return { success: false, error: "Request not found." };
  const ownsIt = me && req.employeeId === me.id;
  if (!ownsIt && !can(u.role, "hr:write")) return { success: false, error: "Not authorized." };
  if (req.status !== "PENDING" && req.status !== "APPROVED") return { success: false, error: "Only pending or approved leave can be cancelled." };

  const year = req.startDate.getUTCFullYear();
  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id: requestId }, data: { status: "CANCELLED", decidedAt: new Date() } });
    const bal = await tx.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year } },
    });
    if (bal) {
      if (req.status === "PENDING") await tx.leaveBalance.update({ where: { id: bal.id }, data: { pending: { decrement: req.days } } });
      else await tx.leaveBalance.update({ where: { id: bal.id }, data: { used: { decrement: req.days } } });
    }
    await tx.activityLog.create({
      data: { action: "LEAVE_CANCELLED", entityType: "LEAVE_REQUEST", entityId: requestId, userId: u.id },
    });
  });

  revalidatePath("/people/leave");
  return { success: true, data: { id: requestId } };
}

// ============================================================
// Team calendar — approved + pending leave in a month window
// ============================================================
export async function getTeamLeave(year: number, month: number) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { holidays: [], leaves: [] };
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));

  const [leaves, holidays] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: { in: ["APPROVED", "PENDING"] }, startDate: { lte: to }, endDate: { gte: from } },
      include: {
        leaveType: { select: { code: true, color: true } },
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.holiday.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" } }),
  ]);
  return { holidays, leaves };
}
