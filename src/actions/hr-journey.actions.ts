"use server";

import { randomBytes } from "crypto";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { ONBOARDING_TASKS, OFFBOARDING_TASKS } from "@/lib/hr/constants";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

// ============================================================
// Start an onboarding / offboarding journey
// ============================================================
export async function startOnboarding(employeeId: string, joiningDate?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
  if (!emp) return { success: false, error: "Employee not found." };

  const open = await prisma.employeeJourney.findFirst({ where: { employeeId, type: "ONBOARDING", status: "IN_PROGRESS" } });
  if (open) return { success: false, error: "An onboarding journey is already in progress." };

  const journey = await prisma.$transaction(async (tx) => {
    const j = await tx.employeeJourney.create({
      data: {
        employeeId, type: "ONBOARDING",
        startDate: new Date(),
        targetDate: joiningDate ? new Date(joiningDate) : emp.dateOfJoining,
        tasks: {
          create: ONBOARDING_TASKS.map((t) => ({
            title: t.title, category: t.category, ownerRole: t.ownerRole, blocksDay1: t.blocksDay1, order: t.order,
          })),
        },
      },
    });
    await tx.employee.update({ where: { id: employeeId }, data: { status: "ONBOARDING" } });
    await tx.activityLog.create({ data: { action: "ONBOARDING_STARTED", entityType: "EMPLOYEE_JOURNEY", entityId: j.id, userId: u!.id } });
    return j;
  });
  revalidatePath("/people/lifecycle");
  return { success: true, data: { id: journey.id } };
}

export async function startOffboarding(employeeId: string, lastWorkingDate: string, reason?: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
  if (!emp) return { success: false, error: "Employee not found." };
  if (!lastWorkingDate) return { success: false, error: "Last working day is required." };

  const open = await prisma.employeeJourney.findFirst({ where: { employeeId, type: "OFFBOARDING", status: "IN_PROGRESS" } });
  if (open) return { success: false, error: "An offboarding journey is already in progress." };

  const journey = await prisma.$transaction(async (tx) => {
    const j = await tx.employeeJourney.create({
      data: {
        employeeId, type: "OFFBOARDING", startDate: new Date(),
        targetDate: new Date(lastWorkingDate), reason: reason || null,
        tasks: {
          create: OFFBOARDING_TASKS.map((t) => ({
            title: t.title, category: t.category, ownerRole: t.ownerRole, blocksDay1: t.blocksDay1, order: t.order,
          })),
        },
      },
    });
    await tx.activityLog.create({ data: { action: "OFFBOARDING_STARTED", entityType: "EMPLOYEE_JOURNEY", entityId: j.id, userId: u!.id, changes: { reason: reason || null } } });
    return j;
  });
  revalidatePath("/people/lifecycle");
  return { success: true, data: { id: journey.id } };
}

// ============================================================
// Lists + detail
// ============================================================
export async function getJourneys(type: "ONBOARDING" | "OFFBOARDING") {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return [];
  const journeys = await prisma.employeeJourney.findMany({
    where: { type },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, empCode: true, photoUrl: true, legalEntity: { select: { shortCode: true, name: true } } } },
      tasks: { select: { status: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return journeys.map((j) => {
    const total = j.tasks.length;
    const done = j.tasks.filter((t) => t.status === "DONE" || t.status === "NA").length;
    return { ...j, tasks: undefined, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  });
}

export async function getJourney(id: string) {
  const u = await requireUser();
  if (!can(u?.role, "hr:read")) return null;
  return prisma.employeeJourney.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, empCode: true, status: true, userId: true } },
      tasks: { orderBy: { order: "asc" } },
      exitInterview: true,
    },
  });
}

// ============================================================
// Task updates
// ============================================================
export async function updateJourneyTask(taskId: string, status: string, assigneeId?: string | null): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const valid = ["PENDING", "IN_PROGRESS", "DONE", "NA", "BLOCKED"];
  if (!valid.includes(status)) return { success: false, error: "Invalid status." };

  const data: Prisma.JourneyTaskUpdateInput = {
    status: status as Prisma.JourneyTaskUpdateInput["status"],
    completedAt: status === "DONE" ? new Date() : null,
  };
  if (assigneeId !== undefined) data.assigneeId = assigneeId || null;

  const task = await prisma.journeyTask.update({ where: { id: taskId }, data });
  revalidatePath(`/people/lifecycle/${task.journeyId}`);
  return { success: true, data: { id: taskId } };
}

// ============================================================
// Complete journey — applies status transition + access changes
// ============================================================
export async function completeJourney(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };

  const journey = await prisma.employeeJourney.findUnique({ where: { id }, include: { tasks: true, employee: { select: { id: true, userId: true } } } });
  if (!journey || journey.status !== "IN_PROGRESS") return { success: false, error: "Journey not found or already closed." };

  // Day-1 / clearance gate: all blocking tasks must be DONE or NA.
  const blocking = journey.tasks.filter((t) => t.blocksDay1);
  const blockingOpen = blocking.filter((t) => t.status !== "DONE" && t.status !== "NA");
  if (blockingOpen.length > 0)
    return { success: false, error: `${blockingOpen.length} blocking task(s) still open: ${blockingOpen.map((t) => t.title).join(", ")}` };

  try {
  await prisma.$transaction(async (tx) => {
    // Conditionally flip IN_PROGRESS → COMPLETED; count 0 means another request
    // already completed it, so abort to avoid double access-grant/revoke.
    const flip = await tx.employeeJourney.updateMany({
      where: { id, status: "IN_PROGRESS" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (flip.count === 0) throw new Error("ALREADY_CLOSED");
    if (journey.type === "ONBOARDING") {
      // Candidate → active employee; activate linked login if present.
      await tx.employee.update({ where: { id: journey.employeeId }, data: { status: "ACTIVE" } });
      if (journey.employee.userId) await tx.user.update({ where: { id: journey.employee.userId }, data: { isActive: true } });
      await tx.activityLog.create({ data: { action: "ONBOARDING_COMPLETED", entityType: "EMPLOYEE", entityId: journey.employeeId, userId: u!.id } });
    } else {
      // Exit: mark employee exited + revoke platform access (RBAC).
      await tx.employee.update({
        where: { id: journey.employeeId },
        data: { status: "EXITED", dateOfExit: journey.targetDate ?? new Date() },
      });
      if (journey.employee.userId) await tx.user.update({ where: { id: journey.employee.userId }, data: { isActive: false } });
      await tx.activityLog.create({ data: { action: "OFFBOARDING_COMPLETED", entityType: "EMPLOYEE", entityId: journey.employeeId, userId: u!.id } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_CLOSED") return { success: false, error: "This journey was already completed." };
    return { success: false, error: "Could not complete the journey." };
  }
  revalidatePath("/people/lifecycle");
  revalidatePath(`/people/lifecycle/${id}`);
  revalidatePath(`/people/${journey.employeeId}`);
  return { success: true, data: { id } };
}

export async function submitExitInterview(journeyId: string, input: { reason?: string; feedback?: string; rating?: number }): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const journey = await prisma.employeeJourney.findUnique({ where: { id: journeyId } });
  if (!journey || journey.type !== "OFFBOARDING") return { success: false, error: "Offboarding journey not found." };

  await prisma.exitInterview.upsert({
    where: { journeyId },
    create: { journeyId, reason: input.reason || null, feedback: input.feedback || null, rating: input.rating ?? null, conductedBy: u!.name ?? null },
    update: { reason: input.reason || null, feedback: input.feedback || null, rating: input.rating ?? null, conductedBy: u!.name ?? null },
  });
  revalidatePath(`/people/lifecycle/${journeyId}`);
  return { success: true, data: { id: journeyId } };
}

// ============================================================
// Candidate pre-joining portal (token-scoped, no login)
// ============================================================
export async function createPortalInvite(employeeId: string): Promise<Result<{ token: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:write")) return { success: false, error: "Not authorized." };
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null } });
  if (!emp) return { success: false, error: "Employee not found." };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 86400000); // 14 days
  await prisma.candidatePortalInvite.create({ data: { employeeId, token, expiresAt } });
  return { success: true, data: { token } };
}

// PUBLIC — resolve an invite by token (no auth). Returns minimal employee data.
export async function getCandidatePortal(token: string) {
  const invite = await prisma.candidatePortalInvite.findUnique({ where: { token } });
  if (!invite) return { ok: false as const, reason: "invalid" as const };
  if (invite.usedAt) return { ok: false as const, reason: "used" as const };
  if (invite.expiresAt < new Date()) return { ok: false as const, reason: "expired" as const };
  const emp = await prisma.employee.findUnique({
    where: { id: invite.employeeId },
    select: { id: true, firstName: true, lastName: true, personalEmail: true, phone: true, legalEntity: { select: { name: true } } },
  });
  if (!emp) return { ok: false as const, reason: "invalid" as const };
  return { ok: true as const, employee: emp };
}

// PUBLIC — candidate submits/confirms their basic details (no auth, token-scoped).
export async function submitCandidateDetails(token: string, input: { phone?: string; personalEmail?: string }): Promise<Result<{ ok: true }>> {
  const invite = await prisma.candidatePortalInvite.findUnique({ where: { token } });
  if (!invite) return { success: false, error: "This link is invalid." };
  if (invite.usedAt) return { success: false, error: "This link has already been used." };
  if (invite.expiresAt < new Date()) return { success: false, error: "This link has expired." };

  // Validate untrusted public input.
  const phone = input.phone?.trim();
  const personalEmail = input.personalEmail?.trim();
  if (phone && !/^[+]?[\d\s()-]{7,20}$/.test(phone)) return { success: false, error: "Please enter a valid phone number." };
  if (personalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail)) return { success: false, error: "Please enter a valid email address." };

  // Atomically claim the single-use invite first — guards against concurrent
  // double-submission (count 0 means another request already consumed it).
  const claim = await prisma.candidatePortalInvite.updateMany({
    where: { id: invite.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claim.count === 0) return { success: false, error: "This link has already been used." };

  await prisma.employee.update({
    where: { id: invite.employeeId },
    data: { phone: phone || undefined, personalEmail: personalEmail || undefined },
  });
  return { success: true, data: { ok: true } };
}
