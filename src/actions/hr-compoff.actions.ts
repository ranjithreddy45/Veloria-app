"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
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

// Resolve the Employee record for the signed-in user (self-service).
async function myEmployee(userId: string) {
  return prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
}

// A comp-off is EXPIRED the moment its expiryDate is in the past — the stored
// status may still read AVAILABLE (we don't run a sweep cron), so treat expiry
// as authoritative when reading and redeeming. Compare in IST so a comp-off
// doesn't lapse a few hours early for an India-based workforce.
function isExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return false;
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return expiryDate.getTime() < istNow.getTime();
}

// Default validity window: a comp-off earned today is usable for 90 days.
const DEFAULT_EXPIRY_DAYS = 90;
function defaultExpiry(from: Date): Date {
  return new Date(from.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

// Parse a yyyy-mm-dd date input to a UTC midnight instant (matches the rest of
// the HR module's date handling — dates are stored at UTC midnight).
function parseDateOnly(s: string): Date | null {
  const d = new Date(s + "T00:00:00.000Z");
  return isNaN(d.getTime()) ? null : d;
}

// ============================================================
// Grant an earned comp-off (HR / manager)
// ============================================================
export interface GrantCompOffInput {
  employeeId: string;
  /** The holiday/weekend the employee worked (yyyy-mm-dd). */
  workedDate: string;
  /** Optional explicit expiry (yyyy-mm-dd); defaults to workedDate + 90 days. */
  expiryDate?: string;
  /** Optional whole/half day credit; defaults to 1. */
  days?: number;
  reason?: string;
}

export async function grantCompOff(input: GrantCompOffInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!can(u.role, "hr:write")) return { success: false, error: "Not authorized to grant comp-offs." };

  const emp = await prisma.employee.findFirst({
    where: { id: input.employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  const worked = parseDateOnly(input.workedDate);
  if (!worked) return { success: false, error: "Invalid worked date." };

  let expiry: Date;
  if (input.expiryDate) {
    const e = parseDateOnly(input.expiryDate);
    if (!e) return { success: false, error: "Invalid expiry date." };
    if (e.getTime() <= worked.getTime()) return { success: false, error: "Expiry date must be after the worked date." };
    expiry = e;
  } else {
    expiry = defaultExpiry(worked);
  }

  const days = input.days == null ? 1 : input.days;
  if (!(days > 0) || days > 1) return { success: false, error: "Days must be between 0 and 1 (whole or half day)." };

  // Duplicate guard: one comp-off per employee + worked date. A day worked can
  // only be banked once, regardless of the earlier grant's current status.
  const dup = await prisma.compOff.findFirst({
    where: { employeeId: emp.id, workedDate: worked },
    select: { id: true },
  });
  if (dup) return { success: false, error: "A comp-off already exists for this employee on that worked date." };

  try {
    const created = await prisma.compOff.create({
      data: {
        employeeId: emp.id,
        workedDate: worked,
        days,
        reason: input.reason?.trim() || null,
        expiryDate: expiry,
        status: "AVAILABLE",
      },
    });
    await prisma.activityLog.create({
      data: {
        action: "COMPOFF_GRANTED",
        entityType: "COMP_OFF",
        entityId: created.id,
        userId: u.id,
        changes: { employeeId: emp.id, workedDate: input.workedDate, days },
      },
    });
    revalidatePath("/people/leave/comp-off");
    return { success: true, data: { id: created.id } };
  } catch {
    return { success: false, error: "Could not grant comp-off." };
  }
}

// ============================================================
// Self-service: my comp-offs + counts
// ============================================================
export async function getMyCompOffs() {
  const u = await requireUser();
  if (!u?.id) return null;
  const emp = await myEmployee(u.id);
  if (!emp) return { linked: false as const };

  const rows = await prisma.compOff.findMany({
    where: { employeeId: emp.id },
    orderBy: { workedDate: "desc" },
  });

  // Derive the effective status (an AVAILABLE row past its expiry reads EXPIRED).
  const items = rows.map((r) => {
    const effectiveStatus =
      r.status === "AVAILABLE" && isExpired(r.expiryDate) ? "EXPIRED" : r.status;
    return {
      id: r.id,
      workedDate: r.workedDate.toISOString(),
      days: r.days,
      reason: r.reason,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
      status: effectiveStatus as "AVAILABLE" | "USED" | "EXPIRED",
      createdAt: r.createdAt.toISOString(),
      redeemable: effectiveStatus === "AVAILABLE",
    };
  });

  const availableDays = items
    .filter((i) => i.status === "AVAILABLE")
    .reduce((s, i) => s + i.days, 0);
  const usedDays = items.filter((i) => i.status === "USED").reduce((s, i) => s + i.days, 0);
  const expiredDays = items.filter((i) => i.status === "EXPIRED").reduce((s, i) => s + i.days, 0);

  return {
    linked: true as const,
    employeeId: emp.id,
    items,
    counts: { available: availableDays, used: usedDays, expired: expiredDays },
  };
}

// ============================================================
// HR view: grant history + balances across employees
// ============================================================
export async function getCompOffAdmin() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { canManage: false, employees: [], rows: [] };

  const [employees, rows] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null, status: { not: "EXITED" } },
      select: { id: true, empCode: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.compOff.findMany({
      include: { employee: { select: { id: true, firstName: true, lastName: true, empCode: true } } },
      orderBy: { workedDate: "desc" },
      take: 300,
    }),
  ]);

  const mapped = rows.map((r) => {
    const effectiveStatus =
      r.status === "AVAILABLE" && isExpired(r.expiryDate) ? "EXPIRED" : r.status;
    return {
      id: r.id,
      employee: {
        id: r.employee.id,
        name: `${r.employee.firstName} ${r.employee.lastName}`.trim(),
        empCode: r.employee.empCode,
      },
      workedDate: r.workedDate.toISOString(),
      days: r.days,
      reason: r.reason,
      expiryDate: r.expiryDate ? r.expiryDate.toISOString() : null,
      status: effectiveStatus as "AVAILABLE" | "USED" | "EXPIRED",
    };
  });

  return {
    canManage: can(u?.role, "hr:write"),
    employees: employees.map((e) => ({
      id: e.id,
      empCode: e.empCode,
      firstName: e.firstName,
      lastName: e.lastName,
    })),
    rows: mapped,
  };
}

// ============================================================
// Redeem an available comp-off (self-service, or HR on behalf)
// ============================================================
export async function redeemCompOff(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);

  const co = await prisma.compOff.findUnique({ where: { id } });
  if (!co) return { success: false, error: "Comp-off not found." };

  // Ownership: the earning employee, or an HR user acting on their behalf.
  const ownsIt = me && co.employeeId === me.id;
  if (!ownsIt && !can(u.role, "hr:write")) return { success: false, error: "Not authorized." };

  // Status + expiry guards (idempotent — a used/expired row can't be re-redeemed).
  if (co.status !== "AVAILABLE") {
    return { success: false, error: co.status === "USED" ? "This comp-off has already been used." : "This comp-off has expired." };
  }
  if (isExpired(co.expiryDate)) {
    return { success: false, error: "This comp-off has expired and can no longer be used." };
  }

  try {
    // Guard the transition at the DB level too: only flip a row that is still
    // AVAILABLE, so two concurrent redeems can't both succeed.
    const res = await prisma.compOff.updateMany({
      where: { id, status: "AVAILABLE" },
      data: { status: "USED" },
    });
    if (res.count === 0) return { success: false, error: "This comp-off is no longer available." };

    await prisma.activityLog.create({
      data: {
        action: "COMPOFF_REDEEMED",
        entityType: "COMP_OFF",
        entityId: id,
        userId: u.id,
        changes: { employeeId: co.employeeId, days: co.days },
      },
    });
    revalidatePath("/people/leave/comp-off");
    return { success: true, data: { id } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Could not redeem comp-off." };
  }
}
