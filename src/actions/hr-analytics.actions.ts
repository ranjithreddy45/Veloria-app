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
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setUTCFullYear(now.getUTCFullYear() - 1);

  const [
    entities, verticals, departments,
    total, active, onboarding, onLeave,
    byEntityRaw, byVerticalRaw, byDeptRaw, byTypeRaw,
    exits12m, activeCycle, pendingLeave,
    // Demographics: all queries below inherit `base` (deletedAt: null), so soft-deleted
    // employees are excluded everywhere. Exited employees are soft-deleted, so `base`
    // already means "current employees".
    genderRaw, joinedThisMonth, activeJoiningRows, dobRows,
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
    // Gender split over all current (non-deleted) employees — matches headcount total.
    prisma.employee.groupBy({ by: ["gender"], where: base, _count: { _all: true } }),
    // "Joined this period" — dateOfJoining in the current calendar month (UTC bounds).
    prisma.employee.count({ where: { ...base, dateOfJoining: { gte: monthStart, lt: nextMonthStart } } }),
    // Tenure is computed for ACTIVE employees only (per spec). One query, one column.
    prisma.employee.findMany({ where: { ...base, status: "ACTIVE" }, select: { dateOfJoining: true } }),
    // Age profile over all current (non-deleted) employees. One query, one column.
    prisma.employee.findMany({ where: base, select: { dob: true } }),
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

  // --- Gender split ---------------------------------------------------------
  // gender is a free-text String? column; null/blank collapses to "Not specified"
  // (never silently dropped). Values are lightly normalized (trim + title-case)
  // so "male"/"Male" don't split into separate slices.
  const genderCounts = new Map<string, number>();
  for (const r of genderRaw) {
    const label = normalizeGender(r.gender);
    genderCounts.set(label, (genderCounts.get(label) ?? 0) + r._count._all);
  }
  const genderTotal = Array.from(genderCounts.values()).reduce((a, b) => a + b, 0);
  const genderSplit = Array.from(genderCounts.entries())
    .map(([name, value]) => ({ name, value, pct: genderTotal ? Math.round((value / genderTotal) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  // --- Tenure distribution + average (ACTIVE employees) ---------------------
  // Null dateOfJoining -> "Unknown" bucket (never silently excluded). Tenure in
  // fractional years from an absolute-timestamp diff (timezone-independent).
  const tenureBuckets: Record<string, number> = { "<1": 0, "1-2": 0, "2-5": 0, "5-10": 0, "10+": 0, Unknown: 0 };
  let tenureSum = 0, tenureKnown = 0;
  for (const r of activeJoiningRows) {
    if (!r.dateOfJoining) { tenureBuckets.Unknown++; continue; }
    const yrs = yearsBetween(r.dateOfJoining, now);
    tenureSum += yrs; tenureKnown++;
    if (yrs < 1) tenureBuckets["<1"]++;
    else if (yrs < 2) tenureBuckets["1-2"]++;
    else if (yrs < 5) tenureBuckets["2-5"]++;
    else if (yrs < 10) tenureBuckets["5-10"]++;
    else tenureBuckets["10+"]++;
  }
  const avgTenureYears = tenureKnown ? Number((tenureSum / tenureKnown).toFixed(1)) : 0;
  const tenureDistribution = ["<1", "1-2", "2-5", "5-10", "10+", "Unknown"].map((name) => ({ name, value: tenureBuckets[name] }));

  // --- Age profile (all current employees) ----------------------------------
  // Age = whole years from dob, computed with UTC calendar parts so nobody flips
  // a bucket on a timezone boundary. Null dob -> "Unknown".
  const ageBuckets: Record<string, number> = { "<25": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, Unknown: 0 };
  for (const r of dobRows) {
    if (!r.dob) { ageBuckets.Unknown++; continue; }
    const age = fullYearsUTC(r.dob, now);
    if (age < 25) ageBuckets["<25"]++;
    else if (age < 35) ageBuckets["25-34"]++;
    else if (age < 45) ageBuckets["35-44"]++;
    else if (age < 55) ageBuckets["45-54"]++;
    else ageBuckets["55+"]++;
  }
  const ageProfile = ["<25", "25-34", "35-44", "45-54", "55+", "Unknown"].map((name) => ({ name, value: ageBuckets[name] }));

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
    // Demographics (all soft-deleted employees already excluded via `base`).
    genderSplit,
    tenure: { distribution: tenureDistribution, avgYears: avgTenureYears },
    ageProfile,
    // "Confirmation Pending" — no confirmation/probation-completion date exists on
    // Employee, so this is derived from status === "ONBOARDING" (still on probation).
    joinedThisMonth,
    confirmationPending: onboarding,
    filterOptions: { entities, verticals },
  };
}

// Light gender normalizer: trims + title-cases so casing/whitespace variants merge;
// null or blank becomes "Not specified".
function normalizeGender(g: string | null): string {
  const t = (g ?? "").trim();
  if (!t) return "Not specified";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

// Fractional years between two absolute timestamps (timezone-independent diff).
function yearsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

// Whole years between two dates using UTC calendar parts (stable across timezones,
// correct for @db.Date UTC-midnight values).
function fullYearsUTC(from: Date, to: Date): number {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const m = to.getUTCMonth() - from.getUTCMonth();
  if (m < 0 || (m === 0 && to.getUTCDate() < from.getUTCDate())) years--;
  return years < 0 ? 0 : years;
}
