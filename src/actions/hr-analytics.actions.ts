"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

export interface AnalyticsFilters { legalEntityId?: string; businessVerticalId?: string }

export async function getHrAnalytics(filters: AnalyticsFilters = {}) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read") && !can(u?.role, "analytics:read")) return null;

  const base: Prisma.EmployeeWhereInput = { deletedAt: null };
  if (filters.legalEntityId) base.legalEntityId = filters.legalEntityId;
  if (filters.businessVerticalId) base.businessVerticalId = filters.businessVerticalId;

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setUTCFullYear(now.getUTCFullYear() - 1);

  const [
    entities, verticals, departments,
    total, active, onboarding, onLeave,
    byEntityRaw, byVerticalRaw, byDeptRaw, byTypeRaw,
    exits12m, activeCycle, pendingLeave,
  ] = await Promise.all([
    prisma.legalEntity.findMany({ where: { isActive: true }, select: { id: true, name: true, shortCode: true } }),
    prisma.businessVertical.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.employee.count({ where: base }),
    prisma.employee.count({ where: { ...base, status: "ACTIVE" } }),
    prisma.employee.count({ where: { ...base, status: "ONBOARDING" } }),
    prisma.employee.count({ where: { ...base, status: "ON_LEAVE" } }),
    prisma.employee.groupBy({ by: ["legalEntityId"], where: base, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["businessVerticalId"], where: base, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["departmentId"], where: base, _count: { _all: true } }),
    prisma.employee.groupBy({ by: ["employmentType"], where: base, _count: { _all: true } }),
    prisma.employee.count({ where: { ...base, deletedAt: null, status: "EXITED", dateOfExit: { gte: twelveMonthsAgo } } }),
    prisma.appraisalCycle.findFirst({ where: { status: "ACTIVE" }, orderBy: { startDate: "desc" } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
  ]);

  // Exited employees are soft-deleted, so re-count exits without the deletedAt:null base.
  const exitWhere: Prisma.EmployeeWhereInput = { status: "EXITED", dateOfExit: { gte: twelveMonthsAgo } };
  if (filters.legalEntityId) exitWhere.legalEntityId = filters.legalEntityId;
  if (filters.businessVerticalId) exitWhere.businessVerticalId = filters.businessVerticalId;
  const exits = await prisma.employee.count({ where: exitWhere });

  // Attendance this month: present-ish records / total records.
  const [attTotal, attPresent] = await Promise.all([
    prisma.attendanceRecord.count({ where: { date: { gte: monthStart } } }),
    prisma.attendanceRecord.count({ where: { date: { gte: monthStart }, status: { in: ["PRESENT", "WFH"] } } }),
  ]);

  // Leave taken (approved) this year, by type.
  const leaveApproved = await prisma.leaveRequest.groupBy({
    by: ["leaveTypeId"], where: { status: "APPROVED", startDate: { gte: yearStart } }, _sum: { days: true },
  });
  const leaveTypes = await prisma.leaveType.findMany({ select: { id: true, name: true, code: true } });

  // Appraisal completion for the active cycle.
  let appraisalCompletion: { submitted: number; eligible: number; pct: number } | null = null;
  if (activeCycle) {
    const eligible = active + onLeave;
    const submitted = await prisma.appraisalReview.count({ where: { cycleId: activeCycle.id, kind: "MANAGER", status: "SUBMITTED" } });
    appraisalCompletion = { submitted, eligible, pct: eligible ? Math.round((submitted / eligible) * 100) : 0 };
  }

  const entityName = new Map(entities.map((e) => [e.id, e.shortCode || e.name]));
  const verticalName = new Map(verticals.map((v) => [v.id, v.name]));
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const typeLabels: Record<string, string> = { FULL_TIME: "Full-time", PART_TIME: "Part-time", CONTRACT: "Contract", INTERN: "Intern" };

  const avgHeadcount = (total + exits) / 2 || 1;

  return {
    headcount: { total, active, onboarding, onLeave },
    attrition: { exits12m: exits, ratePct: Math.round((exits / avgHeadcount) * 100) },
    byEntity: byEntityRaw.map((r) => ({ name: entityName.get(r.legalEntityId) ?? "—", value: r._count._all })),
    byVertical: byVerticalRaw.map((r) => ({ name: r.businessVerticalId ? verticalName.get(r.businessVerticalId) ?? "—" : "Unassigned", value: r._count._all })),
    byDepartment: byDeptRaw.map((r) => ({ name: r.departmentId ? deptName.get(r.departmentId) ?? "—" : "Unassigned", value: r._count._all })).sort((a, b) => b.value - a.value),
    byType: byTypeRaw.map((r) => ({ name: typeLabels[r.employmentType] ?? r.employmentType, value: r._count._all })),
    attendance: { totalRecords: attTotal, presentPct: attTotal ? Math.round((attPresent / attTotal) * 100) : null },
    leave: { pending: pendingLeave, byType: leaveApproved.map((r) => ({ name: leaveTypes.find((t) => t.id === r.leaveTypeId)?.code ?? "—", value: r._sum.days ?? 0 })) },
    appraisal: appraisalCompletion,
    cycleName: activeCycle?.name ?? null,
    filterOptions: { entities, verticals },
  };
}
