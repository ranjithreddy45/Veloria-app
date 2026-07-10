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
  // Non-sensitive lookup — every signed-in employee needs the leave types to
  // apply and read balances (ESS). Do NOT gate on hr:read (was hiding setup
  // from ordinary employees, forcing a false "leave not set up" state).
  const u = await requireUser();
  if (!u?.id) return [];
  return prisma.leaveType.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export async function getHolidays(year = currentYear()) {
  // Non-sensitive lookup — every employee sees the holiday calendar (ESS).
  const u = await requireUser();
  if (!u?.id) return [];
  return prisma.holiday.findMany({ where: { year }, orderBy: { date: "asc" } });
}

// ============================================================
// Leave-type configuration (admin CRUD). Replaces the one-shot seed so
// the catalogue can be tuned (entitlement, carry-forward, half-day, colour)
// and new types added without a code change. All gated hr:admin.
// ============================================================
export interface LeaveTypeInput {
  name: string;
  code: string;
  paid: boolean;
  accrualPerYear: number;
  carryForwardMax: number;
  allowHalfDay: boolean;
  allowNegative: boolean;
  requiresApproval: boolean;
  color: string;
  order: number;
}

// Normalise + validate a submitted leave-type payload. Returns an error string
// or a cleaned data object ready for Prisma.
function normalizeLeaveTypeInput(input: LeaveTypeInput): { error: string } | { data: LeaveTypeInput } {
  const name = input.name?.trim();
  if (!name) return { error: "Name is required." };
  const code = input.code?.trim().toUpperCase();
  if (!code) return { error: "Code is required." };
  if (!/^[A-Z0-9_]{1,12}$/.test(code)) return { error: "Code must be 1–12 letters, digits or underscores." };
  const num = (v: number, label: string): number | { error: string } => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return { error: `${label} must be a number ≥ 0.` };
    return n;
  };
  const accrual = num(input.accrualPerYear, "Annual entitlement");
  if (typeof accrual === "object") return accrual;
  const carry = num(input.carryForwardMax, "Carry-forward cap");
  if (typeof carry === "object") return carry;
  const order = num(input.order, "Order");
  if (typeof order === "object") return order;
  return {
    data: {
      name,
      code,
      paid: !!input.paid,
      accrualPerYear: accrual,
      carryForwardMax: carry,
      allowHalfDay: !!input.allowHalfDay,
      allowNegative: !!input.allowNegative,
      requiresApproval: !!input.requiresApproval,
      color: (input.color?.trim() || "blue"),
      order: Math.round(order),
    },
  };
}

export async function createLeaveType(input: LeaveTypeInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const norm = normalizeLeaveTypeInput(input);
  if ("error" in norm) return { success: false, error: norm.error };

  const clash = await prisma.leaveType.findUnique({ where: { code: norm.data.code }, select: { id: true } });
  if (clash) return { success: false, error: `A leave type with code ${norm.data.code} already exists.` };

  try {
    const created = await prisma.leaveType.create({ data: norm.data });
    revalidatePath("/people/leave");
    revalidatePath("/people/leave/types");
    return { success: true, data: { id: created.id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not create leave type." };
  }
}

export async function updateLeaveType(id: string, input: LeaveTypeInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const existing = await prisma.leaveType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, error: "Leave type not found." };

  const norm = normalizeLeaveTypeInput(input);
  if ("error" in norm) return { success: false, error: norm.error };

  // Guard the unique code against any OTHER type.
  const clash = await prisma.leaveType.findFirst({
    where: { code: norm.data.code, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { success: false, error: `A leave type with code ${norm.data.code} already exists.` };

  try {
    await prisma.leaveType.update({ where: { id }, data: norm.data });
    revalidatePath("/people/leave");
    revalidatePath("/people/leave/types");
    return { success: true, data: { id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not update leave type." };
  }
}

export async function setLeaveTypeActive(id: string, isActive: boolean): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const existing = await prisma.leaveType.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, error: "Leave type not found." };
  await prisma.leaveType.update({ where: { id }, data: { isActive: !!isActive } });
  revalidatePath("/people/leave");
  revalidatePath("/people/leave/types");
  return { success: true, data: { id } };
}

// List ALL leave types (active + inactive) for the admin config surface.
export async function getLeaveTypesAdmin() {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return [];
  return prisma.leaveType.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
}

// ============================================================
// Balance provisioning (admin) + admin balances grid (hr:read).
// ------------------------------------------------------------
// provisionLeaveBalances seeds a LeaveBalance row for every active employee ×
// active leave type for a year. IDEMPOTENT: it only inserts rows that are
// missing (createMany + skipDuplicates on the [employeeId, leaveTypeId, year]
// unique key) and NEVER updates existing rows, so re-running never resets an
// employee's used / pending / carriedForward. Writes are chunked so a few
// hundred employees don't blow a single statement.
// ============================================================
export async function provisionLeaveBalances(input: { year: number; leaveTypeId?: string }): Promise<Result<{ created: number; skipped: number }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 3000) return { success: false, error: "Invalid year." };

  const types = await prisma.leaveType.findMany({
    where: { isActive: true, ...(input.leaveTypeId ? { id: input.leaveTypeId } : {}) },
    select: { id: true, accrualPerYear: true },
  });
  if (types.length === 0) return { success: false, error: "No active leave types to provision." };

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  if (employees.length === 0) return { success: true, data: { created: 0, skipped: 0 } };

  const empIds = employees.map((e) => e.id);
  const total = employees.length * types.length;

  // Existing rows in scope — used only to compute the skipped count. The actual
  // insert relies on skipDuplicates so it stays correct even under a race.
  const existing = await prisma.leaveBalance.findMany({
    where: { year, employeeId: { in: empIds }, ...(input.leaveTypeId ? { leaveTypeId: input.leaveTypeId } : {}) },
    select: { employeeId: true, leaveTypeId: true },
  });
  const have = new Set(existing.map((b) => `${b.employeeId}:${b.leaveTypeId}`));

  const toCreate: Prisma.LeaveBalanceCreateManyInput[] = [];
  for (const e of employees) {
    for (const t of types) {
      if (!have.has(`${e.id}:${t.id}`)) {
        toCreate.push({ employeeId: e.id, leaveTypeId: t.id, year, entitled: t.accrualPerYear });
      }
    }
  }

  let created = 0;
  const CHUNK = 500;
  try {
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const batch = toCreate.slice(i, i + CHUNK);
      const res = await prisma.leaveBalance.createMany({ data: batch, skipDuplicates: true });
      created += res.count;
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not provision balances." };
  }

  revalidatePath("/people/leave/balances");
  return { success: true, data: { created, skipped: total - created } };
}

// Employees × leave types with entitled / used / pending / available for a year.
export async function getLeaveBalancesAdmin(input: { year: number; leaveTypeId?: string }) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { year: currentYear(), types: [], rows: [] };

  const year = Number.isInteger(Number(input.year)) ? Number(input.year) : currentYear();

  const types = await prisma.leaveType.findMany({
    where: { isActive: true, ...(input.leaveTypeId ? { id: input.leaveTypeId } : {}) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, color: true },
  });

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true, firstName: true, lastName: true, empCode: true,
      leaveBalances: {
        where: { year, ...(input.leaveTypeId ? { leaveTypeId: input.leaveTypeId } : {}) },
        select: { leaveTypeId: true, entitled: true, carriedForward: true, used: true, pending: true },
      },
    },
  });

  const rows = employees.map((e) => {
    const byType: Record<string, { entitled: number; used: number; pending: number; available: number } | null> = {};
    for (const t of types) {
      const b = e.leaveBalances.find((x) => x.leaveTypeId === t.id);
      byType[t.id] = b
        ? {
            entitled: b.entitled + b.carriedForward,
            used: b.used,
            pending: b.pending,
            available: b.entitled + b.carriedForward - b.used - b.pending,
          }
        : null;
    }
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      empCode: e.empCode,
      byType,
    };
  });

  return { year, types, rows };
}

// ============================================================
// Holiday management (admin CRUD). Replaces the one-shot 2026 seed so
// 2027+ holidays can be added and typos fixed without a code change.
// Dates are stored at UTC midnight to match seedLeaveSetup exactly
// (new Date(yyyy-mm-dd + "T00:00:00.000Z")); @db.Date is compared by that
// same instant, so any drift here would shift the calendar a day.
// ============================================================
export async function getHolidaysAdmin(year = currentYear()) {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return [];
  return prisma.holiday.findMany({ where: { year }, orderBy: { date: "asc" } });
}

export interface UpsertHolidayInput {
  id?: string;
  date: string; // yyyy-mm-dd
  name: string;
  year?: number; // derived from the date when omitted
}

export async function upsertHoliday(input: UpsertHolidayInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Holiday name is required." };

  // UTC-midnight instant, identical to how seedLeaveSetup writes holiday dates.
  const date = new Date(input.date + "T00:00:00.000Z");
  if (isNaN(date.getTime())) return { success: false, error: "Invalid date." };
  const year = input.year ?? date.getUTCFullYear();

  // Block a duplicate date (any other holiday already sits on that calendar day).
  const clash = await prisma.holiday.findFirst({
    where: { date, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { success: false, error: "A holiday already exists on that date." };

  try {
    let id = input.id;
    if (id) {
      const existing = await prisma.holiday.findUnique({ where: { id } });
      if (!existing) return { success: false, error: "Holiday not found." };
      await prisma.holiday.update({ where: { id }, data: { date, name, year } });
    } else {
      const created = await prisma.holiday.create({ data: { date, name, year } });
      id = created.id;
    }
    revalidatePath("/people/leave");
    revalidatePath("/people/leave/holidays");
    return { success: true, data: { id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not save holiday." };
  }
}

export async function deleteHoliday(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) return { success: false, error: "Holiday not found." };
  await prisma.holiday.delete({ where: { id } });
  revalidatePath("/people/leave");
  revalidatePath("/people/leave/holidays");
  return { success: true, data: { id } };
}

async function holidayKeySet(year: number): Promise<Set<string>> {
  const hols = await prisma.holiday.findMany({ where: { year }, select: { date: true } });
  return new Set(hols.map((h) => dateKey(h.date)));
}

// Split a leave range into the working-day count chargeable to EACH calendar
// year it touches. A span crossing a year boundary (e.g. 30-Dec → 05-Jan) must
// deduct each year's days from that year's LeaveBalance row, not dump them all
// on the start year. Half-day parts only apply on the true first/last day, so
// they ride with whichever year's window contains that boundary day.
function workingDaysByYear(
  start: Date,
  end: Date,
  startPart: HalfDayPart,
  endPart: HalfDayPart,
  holidays: Set<string>
): Map<number, number> {
  const byYear = new Map<number, number>();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  for (let y = startYear; y <= endYear; y++) {
    // Clamp this year's window to the leave range.
    const segStart = y === startYear ? start : new Date(Date.UTC(y, 0, 1));
    const segEnd = y === endYear ? end : new Date(Date.UTC(y, 11, 31));
    // Half-day parts apply only on the genuine first/last day of the whole range.
    const segStartPart = y === startYear ? startPart : "FULL";
    const segEndPart = y === endYear ? endPart : "FULL";
    const d = workingDays(segStart, segEnd, segStartPart, segEndPart, holidays);
    if (d > 0) byYear.set(y, d);
  }
  return byYear;
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

// Recompute the per-year working-day split for an existing request, so the
// approve/cancel pipeline moves balances on the SAME year rows applyLeave
// reserved them on. Loads holidays for every year the request spans.
async function requestDaysByYear(req: {
  startDate: Date;
  endDate: Date;
  startPart: string;
  endPart: string;
}): Promise<Map<number, number>> {
  const startYear = req.startDate.getUTCFullYear();
  const endYear = req.endDate.getUTCFullYear();
  const holidays = new Set<string>();
  for (let y = startYear; y <= endYear; y++) {
    for (const k of await holidayKeySet(y)) holidays.add(k);
  }
  return workingDaysByYear(
    req.startDate,
    req.endDate,
    req.startPart as HalfDayPart,
    req.endPart as HalfDayPart,
    holidays
  );
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

  // 25th-cutoff punctuality flag: on time if applied on/before the 25th of the
  // month, late after. Compute the day-of-month in IST (fixed +5:30), not UTC,
  // so an application late on the 25th IST doesn't roll into the 26th in UTC.
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const appliedOnTime = istNow.getUTCDate() <= 25;

  const year = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  // Load holidays for every calendar year the range touches so a span crossing a
  // year boundary (e.g. 30-Dec → 03-Jan) doesn't mis-count the second year's holidays.
  const holidays = new Set<string>();
  for (let y = year; y <= endYear; y++) {
    for (const k of await holidayKeySet(y)) holidays.add(k);
  }
  const days = workingDays(start, end, startPart, endPart, holidays);
  if (days <= 0) return { success: false, error: "The selected dates are all weekends/holidays — no working days to apply." };

  // Per-year breakdown so a range crossing a year boundary charges each year's
  // own LeaveBalance row (and is validated against that year's entitlement).
  const daysByYear = workingDaysByYear(start, end, startPart, endPart, holidays);

  // Overlap guard against existing pending/approved requests.
  const existing = await prisma.leaveRequest.findMany({
    where: { employeeId, status: { in: ["PENDING", "APPROVED"] } },
    select: { startDate: true, endDate: true },
  });
  if (existing.some((e) => rangesOverlap(start, end, e.startDate, e.endDate)))
    return { success: false, error: "You already have a leave request overlapping these dates." };

  for (let y = year; y <= endYear; y++) await ensureBalances(employeeId, y);

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Balance check (unless the type allows negative, e.g. LOP). Validate
      // EACH calendar year the leave touches against that year's own row.
      if (!type.allowNegative) {
        for (const [y, d] of daysByYear) {
          const bal = await tx.leaveBalance.findUnique({
            where: { employeeId_leaveTypeId_year: { employeeId: employeeId!, leaveTypeId: type.id, year: y } },
          });
          const available = (bal?.entitled ?? 0) + (bal?.carriedForward ?? 0) - (bal?.used ?? 0) - (bal?.pending ?? 0);
          if (d > available + 1e-9)
            throw new Error(`Insufficient ${type.code} balance for ${y}: ${available} day(s) available, ${d} requested.`);
        }
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
          appliedOnTime,
          status: type.requiresApproval ? "PENDING" : "APPROVED",
          approverId: emp.reportingManagerId,
          decidedAt: type.requiresApproval ? null : new Date(),
        },
      });

      // Reserve the balance (pending) — or directly used if auto-approved —
      // on each year's row by that year's share of the days.
      for (const [y, d] of daysByYear) {
        await tx.leaveBalance.update({
          where: { employeeId_leaveTypeId_year: { employeeId: employeeId!, leaveTypeId: type.id, year: y } },
          data: type.requiresApproval ? { pending: { increment: d } } : { used: { increment: d } },
        });
      }

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

  // Per-year split so the reserved pending balance is moved off the same year
  // rows applyLeave reserved it on (a span crossing a year boundary touches two).
  const daysByYear = await requestDaysByYear(req);

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: decision, decidedAt: new Date(), decisionNote: note || null, approverId: me?.id ?? req.approverId },
    });
    // Move the reserved pending balance on each year's row.
    for (const [year, d] of daysByYear) {
      const bal = await tx.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year } },
      });
      if (!bal) continue;
      if (decision === "APPROVED") {
        await tx.leaveBalance.update({
          where: { id: bal.id },
          data: { pending: { decrement: d }, used: { increment: d } },
        });
      } else {
        await tx.leaveBalance.update({ where: { id: bal.id }, data: { pending: { decrement: d } } });
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

  // Per-year split so the release lands on the same year rows that were charged.
  const daysByYear = await requestDaysByYear(req);
  const wasPending = req.status === "PENDING";
  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id: requestId }, data: { status: "CANCELLED", decidedAt: new Date() } });
    for (const [year, d] of daysByYear) {
      const bal = await tx.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId: req.employeeId, leaveTypeId: req.leaveTypeId, year } },
      });
      if (!bal) continue;
      if (wasPending) await tx.leaveBalance.update({ where: { id: bal.id }, data: { pending: { decrement: d } } });
      else await tx.leaveBalance.update({ where: { id: bal.id }, data: { used: { decrement: d } } });
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
