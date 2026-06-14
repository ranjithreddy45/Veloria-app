"use server";

import { auth } from "@/../auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { withinRadius, ipAllowed, clientIpFromHeaders } from "@/lib/hr/geo";
import { FULL_DAY_MINUTES, HALF_DAY_MINUTES } from "@/lib/hr/constants";

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
  return prisma.employee.findFirst({
    where: { userId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, reportingManagerId: true, legalEntityId: true },
  });
}
function todayUtcMidnight(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

// ============================================================
// Sites (admin)
// ============================================================
export async function getAttendanceSites() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.attendanceSite.findMany({ orderBy: { name: "asc" } });
}

export interface SiteInput {
  id?: string; name: string; legalEntityId?: string; lat?: number; lng?: number;
  radiusMeters?: number; allowedIps?: string; allowWfh?: boolean; isActive?: boolean;
}

export async function upsertAttendanceSite(input: SiteInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!input.name?.trim()) return { success: false, error: "Site name is required." };

  const data = {
    name: input.name.trim(),
    legalEntityId: input.legalEntityId || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    radiusMeters: input.radiusMeters ?? 200,
    allowedIps: input.allowedIps?.trim() || null,
    allowWfh: input.allowWfh ?? true,
    isActive: input.isActive ?? true,
  };
  const rec = input.id
    ? await prisma.attendanceSite.update({ where: { id: input.id }, data })
    : await prisma.attendanceSite.create({ data });
  revalidatePath("/people/attendance/sites");
  return { success: true, data: { id: rec.id } };
}

// ============================================================
// Check-in / Check-out
// ============================================================
export async function checkIn(input: { lat?: number; lng?: number; selfieUrl?: string }): Promise<Result<{ status: string; siteName: string | null }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const emp = await myEmployee(u.id);
  if (!emp) return { success: false, error: "Your account isn't linked to an employee record yet." };

  const date = todayUtcMidnight();
  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: emp.id, date } },
  });
  if (existing?.checkInAt) return { success: false, error: "You've already checked in today." };

  // Resolve client IP.
  const h = await headers();
  const ip = clientIpFromHeaders(h.get("x-forwarded-for"), h.get("x-real-ip"));

  // Match against active geo sites.
  const sites = await prisma.attendanceSite.findMany({ where: { isActive: true } });
  const geoSites = sites.filter((s) => s.lat != null && s.lng != null);

  let matchedSite: (typeof sites)[number] | null = null;
  let status: "PRESENT" | "WFH" = "PRESENT";

  if (geoSites.length > 0) {
    if (input.lat != null && input.lng != null) {
      matchedSite = geoSites.find((s) => withinRadius(input.lat!, input.lng!, s.lat!, s.lng!, s.radiusMeters)) ?? null;
    }
    if (matchedSite) {
      // IP restriction (if any) must also pass.
      if (!ipAllowed(ip, matchedSite.allowedIps))
        return { success: false, error: "Check-in blocked: your network isn't allowed for this site." };
      status = "PRESENT";
    } else {
      // Not at any site — only allowed if some site permits WFH.
      const anyWfh = sites.some((s) => s.allowWfh);
      if (!anyWfh) return { success: false, error: "You're outside all allowed check-in locations." };
      status = "WFH";
    }
  } else {
    // No geo sites configured → unrestricted; treat in-office if IP allowed by any site, else WFH.
    const ipSite = sites.find((s) => s.allowedIps && ipAllowed(ip, s.allowedIps));
    if (ipSite) { matchedSite = ipSite; status = "PRESENT"; }
    else status = sites.length === 0 ? "PRESENT" : "WFH";
  }

  const now = new Date();
  const rec = await prisma.attendanceRecord.upsert({
    where: { employeeId_date: { employeeId: emp.id, date } },
    create: {
      employeeId: emp.id, date, checkInAt: now,
      checkInLat: input.lat ?? null, checkInLng: input.lng ?? null, checkInIp: ip,
      siteId: matchedSite?.id ?? null, source: "WEB", status, selfieUrl: input.selfieUrl || null,
    },
    update: { checkInAt: now, checkInLat: input.lat ?? null, checkInLng: input.lng ?? null, checkInIp: ip, siteId: matchedSite?.id ?? null, status },
  });
  await prisma.activityLog.create({
    data: { action: "ATTENDANCE_CHECK_IN", entityType: "ATTENDANCE", entityId: rec.id, userId: u.id, changes: { status } },
  });
  revalidatePath("/people/attendance");
  return { success: true, data: { status, siteName: matchedSite?.name ?? null } };
}

export async function checkOut(): Promise<Result<{ workedMinutes: number; status: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const emp = await myEmployee(u.id);
  if (!emp) return { success: false, error: "No employee record." };

  const date = todayUtcMidnight();
  const rec = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });
  if (!rec?.checkInAt) return { success: false, error: "You haven't checked in today." };
  if (rec.checkOutAt) return { success: false, error: "You've already checked out today." };

  const now = new Date();
  const workedMinutes = Math.max(0, Math.round((now.getTime() - rec.checkInAt.getTime()) / 60000));
  // Downgrade to half-day if short; keep WFH vs PRESENT otherwise.
  let status = rec.status;
  if (workedMinutes < HALF_DAY_MINUTES) status = "HALF_DAY";

  await prisma.attendanceRecord.update({
    where: { id: rec.id },
    data: { checkOutAt: now, workedMinutes, status },
  });
  await prisma.activityLog.create({
    data: { action: "ATTENDANCE_CHECK_OUT", entityType: "ATTENDANCE", entityId: rec.id, userId: u.id, changes: { workedMinutes } },
  });
  revalidatePath("/people/attendance");
  return { success: true, data: { workedMinutes, status } };
}

// ============================================================
// My attendance (today + month)
// ============================================================
export async function getMyAttendance(year?: number, month?: number) {
  const u = await requireUser();
  if (!u?.id) return null;
  const emp = await myEmployee(u.id);
  if (!emp) return { linked: false as const };

  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1));
  const to = new Date(Date.UTC(y, m + 1, 0));
  const today = todayUtcMidnight();

  const [todayRec, monthRecs] = await Promise.all([
    prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date: today } } }),
    prisma.attendanceRecord.findMany({ where: { employeeId: emp.id, date: { gte: from, lte: to } }, orderBy: { date: "desc" } }),
  ]);

  const presentDays = monthRecs.filter((r) => r.status === "PRESENT" || r.status === "WFH").length;
  const halfDays = monthRecs.filter((r) => r.status === "HALF_DAY").length;
  const totalMinutes = monthRecs.reduce((s, r) => s + r.workedMinutes, 0);

  return {
    linked: true as const, employeeId: emp.id, year: y, month: m,
    today: todayRec, records: monthRecs,
    stats: { presentDays, halfDays, totalHours: Math.round(totalMinutes / 60) },
  };
}

// ============================================================
// Regularization
// ============================================================
export async function requestRegularization(input: {
  date: string; requestedStatus: string; reason: string; checkIn?: string; checkOut?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const emp = await myEmployee(u.id);
  if (!emp) return { success: false, error: "No employee record." };
  if (!input.reason?.trim()) return { success: false, error: "Please give a reason." };

  const date = new Date(input.date + "T00:00:00.000Z");
  if (isNaN(date.getTime())) return { success: false, error: "Invalid date." };

  // Only statuses an employee may legitimately request a correction to.
  const ALLOWED_REG_STATUSES = ["PRESENT", "HALF_DAY", "WFH", "ON_LEAVE"] as const;
  if (!ALLOWED_REG_STATUSES.includes(input.requestedStatus as (typeof ALLOWED_REG_STATUSES)[number]))
    return { success: false, error: "Invalid requested status." };

  const rec = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: emp.id, date } } });

  const reg = await prisma.regularization.create({
    data: {
      employeeId: emp.id,
      attendanceRecordId: rec?.id ?? null,
      date,
      requestedStatus: input.requestedStatus as Prisma.RegularizationCreateInput["requestedStatus"],
      requestedCheckIn: input.checkIn ? new Date(`${input.date}T${input.checkIn}:00.000Z`) : null,
      requestedCheckOut: input.checkOut ? new Date(`${input.date}T${input.checkOut}:00.000Z`) : null,
      reason: input.reason.trim(),
      approverId: emp.reportingManagerId,
    },
  });
  revalidatePath("/people/attendance");
  revalidatePath("/people/attendance/regularizations");
  return { success: true, data: { id: reg.id } };
}

export async function getRegularizationQueue() {
  const u = await requireUser();
  if (!u?.id) return { rows: [] };
  const isHr = can(u.role, "hr:approve");
  const me = await myEmployee(u.id);
  const where: Prisma.RegularizationWhereInput = isHr
    ? { status: "PENDING" }
    : me ? { status: "PENDING", approverId: me.id } : { id: "__none__" };

  const rows = await prisma.regularization.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true, empCode: true } } },
    orderBy: { createdAt: "asc" },
  });
  return { rows };
}

export async function decideRegularization(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const isHr = can(u.role, "hr:approve");
  const me = await myEmployee(u.id);

  const reg = await prisma.regularization.findUnique({ where: { id } });
  if (!reg || reg.status !== "PENDING") return { success: false, error: "Not found or already decided." };
  if (!isHr && !(me && reg.approverId === me.id)) return { success: false, error: "You're not the approver." };

  await prisma.$transaction(async (tx) => {
    await tx.regularization.update({
      where: { id }, data: { status: decision, decidedAt: new Date(), decisionNote: note || null, approverId: me?.id ?? reg.approverId },
    });
    if (decision === "APPROVED") {
      const workedMinutes = reg.requestedCheckIn && reg.requestedCheckOut
        ? Math.max(0, Math.round((reg.requestedCheckOut.getTime() - reg.requestedCheckIn.getTime()) / 60000))
        : reg.requestedStatus === "HALF_DAY" ? HALF_DAY_MINUTES : FULL_DAY_MINUTES;
      await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: reg.employeeId, date: reg.date } },
        create: {
          employeeId: reg.employeeId, date: reg.date,
          checkInAt: reg.requestedCheckIn, checkOutAt: reg.requestedCheckOut,
          status: reg.requestedStatus, workedMinutes, source: "MANUAL", isRegularized: true,
        },
        update: {
          checkInAt: reg.requestedCheckIn ?? undefined, checkOutAt: reg.requestedCheckOut ?? undefined,
          status: reg.requestedStatus, workedMinutes, isRegularized: true,
        },
      });
    }
    await tx.activityLog.create({
      data: { action: decision === "APPROVED" ? "REGULARIZATION_APPROVED" : "REGULARIZATION_REJECTED", entityType: "REGULARIZATION", entityId: id, userId: u.id },
    });
  });
  revalidatePath("/people/attendance/regularizations");
  return { success: true, data: { id } };
}
