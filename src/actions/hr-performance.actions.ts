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
async function myEmployee(userId: string) {
  return prisma.employee.findFirst({ where: { userId, deletedAt: null }, select: { id: true } });
}

// ============================================================
// Cycles (admin)
// ============================================================
export async function listCycles() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  return prisma.appraisalCycle.findMany({ orderBy: { startDate: "desc" } });
}

export async function getActiveCycle() {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;
  return prisma.appraisalCycle.findFirst({ where: { status: "ACTIVE" }, orderBy: { startDate: "desc" } });
}

export async function createCycle(input: { name: string; startDate: string; endDate: string; ratingMax?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  if (!input.name?.trim() || !input.startDate || !input.endDate) return { success: false, error: "Name and dates are required." };
  const c = await prisma.appraisalCycle.create({
    data: { name: input.name.trim(), startDate: new Date(input.startDate), endDate: new Date(input.endDate), ratingMax: input.ratingMax ?? 5 },
  });
  revalidatePath("/people/performance");
  return { success: true, data: { id: c.id } };
}

export async function setCycleStatus(id: string, status: "DRAFT" | "ACTIVE" | "CLOSED"): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  await prisma.appraisalCycle.update({ where: { id }, data: { status } });
  revalidatePath("/people/performance");
  return { success: true, data: { id } };
}

// ============================================================
// Goals / KRAs
// ============================================================
async function canManageEmployee(u: { id: string; role?: string }, employeeId: string) {
  if (can(u.role, "hr:write")) return true;
  const me = await myEmployee(u.id);
  if (me?.id === employeeId) return true; // self
  // direct manager
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { reportingManagerId: true } });
  return !!me && emp?.reportingManagerId === me.id;
}

export async function addGoal(input: { employeeId: string; cycleId: string; title: string; description?: string; weight?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  if (!input.title?.trim()) return { success: false, error: "Title is required." };
  if (!(await canManageEmployee(u, input.employeeId))) return { success: false, error: "Not authorized for this employee." };
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: input.cycleId } });
  if (!cycle || cycle.status === "CLOSED") return { success: false, error: "Cycle is not open." };
  const g = await prisma.goal.create({
    data: { employeeId: input.employeeId, cycleId: input.cycleId, title: input.title.trim(), description: input.description?.trim() || null, weight: input.weight ?? 0 },
  });
  revalidatePath("/people/performance");
  return { success: true, data: { id: g.id } };
}

export async function updateGoal(goalId: string, input: { title?: string; description?: string; weight?: number; status?: string; selfRating?: number; managerRating?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const goal = await prisma.goal.findUnique({ where: { id: goalId }, include: { cycle: true } });
  if (!goal) return { success: false, error: "Goal not found." };
  if (goal.cycle.status === "CLOSED") return { success: false, error: "Cycle is closed." };
  if (!(await canManageEmployee(u, goal.employeeId))) return { success: false, error: "Not authorized." };

  const me = await myEmployee(u.id);
  const isSelf = me?.id === goal.employeeId;
  const data: Prisma.GoalUpdateInput = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.weight !== undefined) data.weight = input.weight;
  if (input.status !== undefined) data.status = input.status as Prisma.GoalUpdateInput["status"];
  // Self may set selfRating; only manager/HR may set managerRating.
  if (input.selfRating !== undefined && isSelf) data.selfRating = clampRating(input.selfRating, goal.cycle.ratingMax);
  if (input.managerRating !== undefined && (can(u.role, "hr:write") || !isSelf)) data.managerRating = clampRating(input.managerRating, goal.cycle.ratingMax);

  await prisma.goal.update({ where: { id: goalId }, data });
  revalidatePath("/people/performance");
  return { success: true, data: { id: goalId } };
}

function clampRating(n: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(n)));
}

export async function deleteGoal(goalId: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const goal = await prisma.goal.findUnique({ where: { id: goalId }, include: { cycle: true } });
  if (!goal) return { success: false, error: "Goal not found." };
  if (goal.cycle.status === "CLOSED") return { success: false, error: "Cycle is closed." };
  if (!(await canManageEmployee(u, goal.employeeId))) return { success: false, error: "Not authorized." };
  await prisma.goal.delete({ where: { id: goalId } });
  revalidatePath("/people/performance");
  return { success: true, data: { id: goalId } };
}

// ============================================================
// My performance (goals + reviews for a cycle)
// ============================================================
export async function getMyPerformance(cycleId?: string) {
  const u = await requireUser();
  if (!u?.id) return null;
  const me = await myEmployee(u.id);
  if (!me) return { linked: false as const };

  const cycle = cycleId
    ? await prisma.appraisalCycle.findUnique({ where: { id: cycleId } })
    : await prisma.appraisalCycle.findFirst({ where: { status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  if (!cycle) return { linked: true as const, employeeId: me.id, cycle: null, goals: [], reviews: [] };

  const [goals, reviews] = await Promise.all([
    prisma.goal.findMany({ where: { employeeId: me.id, cycleId: cycle.id }, orderBy: { createdAt: "asc" } }),
    prisma.appraisalReview.findMany({ where: { cycleId: cycle.id, employeeId: me.id }, orderBy: { kind: "asc" } }),
  ]);
  return { linked: true as const, employeeId: me.id, cycle, goals, reviews };
}

// ============================================================
// Reviews (self / manager / 360)
// ============================================================
export async function submitReview(input: { cycleId: string; employeeId: string; kind: string; rating?: number; strengths?: string; improvements?: string; comments?: string }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };
  const me = await myEmployee(u.id);
  if (!me) return { success: false, error: "Your account isn't linked to an employee record." };

  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: input.cycleId } });
  if (!cycle || cycle.status !== "ACTIVE") return { success: false, error: "Cycle is not active." };

  const kind = ["SELF", "MANAGER", "PEER"].includes(input.kind) ? input.kind : "PEER";
  // Authorisation by kind.
  if (kind === "SELF" && me.id !== input.employeeId) return { success: false, error: "A self review must be your own." };
  if (kind === "MANAGER") {
    const subj = await prisma.employee.findUnique({ where: { id: input.employeeId }, select: { reportingManagerId: true } });
    if (subj?.reportingManagerId !== me.id && !can(u.role, "hr:write"))
      return { success: false, error: "Only the reporting manager (or HR) can submit a manager review." };
  }

  const review = await prisma.appraisalReview.upsert({
    where: { cycleId_employeeId_reviewerId_kind: { cycleId: input.cycleId, employeeId: input.employeeId, reviewerId: me.id, kind: kind as Prisma.AppraisalReviewCreateInput["kind"] } },
    create: {
      cycleId: input.cycleId, employeeId: input.employeeId, reviewerId: me.id,
      kind: kind as Prisma.AppraisalReviewCreateInput["kind"], status: "SUBMITTED",
      rating: input.rating != null ? clampRating(input.rating, cycle.ratingMax) : null,
      strengths: input.strengths?.trim() || null, improvements: input.improvements?.trim() || null, comments: input.comments?.trim() || null,
      submittedAt: new Date(),
    },
    update: {
      status: "SUBMITTED",
      rating: input.rating != null ? clampRating(input.rating, cycle.ratingMax) : null,
      strengths: input.strengths?.trim() || null, improvements: input.improvements?.trim() || null, comments: input.comments?.trim() || null,
      submittedAt: new Date(),
    },
  });
  revalidatePath("/people/performance");
  return { success: true, data: { id: review.id } };
}

// Reviews this user must complete: their direct reports lacking a submitted manager review in the active cycle.
export async function getReviewQueue() {
  const u = await requireUser();
  if (!u?.id) return { cycle: null, rows: [] };
  const me = await myEmployee(u.id);
  if (!me) return { cycle: null, rows: [] };
  const cycle = await prisma.appraisalCycle.findFirst({ where: { status: "ACTIVE" }, orderBy: { startDate: "desc" } });
  if (!cycle) return { cycle: null, rows: [] };

  const reports = await prisma.employee.findMany({
    where: { reportingManagerId: me.id, deletedAt: null, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });
  const reviews = await prisma.appraisalReview.findMany({
    where: { cycleId: cycle.id, reviewerId: me.id, kind: "MANAGER", status: "SUBMITTED" },
    select: { employeeId: true },
  });
  const done = new Set(reviews.map((r) => r.employeeId));
  return { cycle, rows: reports.map((r) => ({ ...r, reviewed: done.has(r.id) })) };
}

// Calibration grid (HR): every employee in the cycle with goal/review rollups.
export async function getCalibration(cycleId: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return { cycle: null, rows: [] };
  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return { cycle: null, rows: [] };

  const goals = await prisma.goal.findMany({
    where: { cycleId },
    include: { employee: { select: { id: true, firstName: true, lastName: true, empCode: true, department: { select: { name: true } } } } },
  });
  const reviews = await prisma.appraisalReview.findMany({ where: { cycleId, status: "SUBMITTED" } });

  const byEmp = new Map<string, { employee: { id: string; firstName: string; lastName: string; empCode: string; department: { name: string } | null }; goals: number; selfAvg: number | null; mgrRating: number | null }>();
  for (const g of goals) {
    const e = byEmp.get(g.employeeId) ?? { employee: g.employee, goals: 0, selfAvg: null, mgrRating: null };
    e.goals++;
    byEmp.set(g.employeeId, e);
  }
  for (const [empId, e] of byEmp) {
    const mgr = reviews.find((r) => r.employeeId === empId && r.kind === "MANAGER");
    e.mgrRating = mgr?.rating ?? null;
    const self = reviews.find((r) => r.employeeId === empId && r.kind === "SELF");
    e.selfAvg = self?.rating ?? null;
  }
  return { cycle, rows: Array.from(byEmp.values()) };
}
