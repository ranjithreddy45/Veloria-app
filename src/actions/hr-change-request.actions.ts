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

// Fields an employee may request to change on their own record.
const SELF_EDITABLE = ["phone", "personalEmail", "workLocation"] as const;
type SelfEditable = (typeof SELF_EDITABLE)[number];

// An employee (or HR on their behalf) requests profile changes → HR approves.
export async function requestProfileChange(
  employeeId: string,
  proposed: Partial<Record<SelfEditable, string>>,
  note?: string
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!u?.id) return { success: false, error: "Not signed in." };

  const emp = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true, userId: true, phone: true, personalEmail: true, workLocation: true },
  });
  if (!emp) return { success: false, error: "Employee not found." };

  // Allowed if: the linked user is the requester (self-service) OR requester has hr:write.
  const isSelf = emp.userId && emp.userId === u.id;
  if (!isSelf && !can(u.role, "hr:write")) return { success: false, error: "Not authorized." };

  const changes: Record<string, { from: string | null; to: string }> = {};
  for (const f of SELF_EDITABLE) {
    const next = proposed[f];
    if (next !== undefined && next !== (emp[f] ?? "")) {
      changes[f] = { from: emp[f] ?? null, to: next };
    }
  }
  if (Object.keys(changes).length === 0) return { success: false, error: "No changes to request." };

  const req = await prisma.employeeChangeRequest.create({
    data: { employeeId, requestedBy: u.id, changes: changes as Prisma.InputJsonValue, note: note || null },
  });
  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/people/requests");
  return { success: true, data: { id: req.id } };
}

export async function getPendingChangeRequests() {
  const u = await requireUser();
  if (!can(u?.role, "hr:approve")) return [];
  const reqs = await prisma.employeeChangeRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  // Attach employee names.
  const empIds = [...new Set(reqs.map((r) => r.employeeId))];
  const emps = await prisma.employee.findMany({
    where: { id: { in: empIds } },
    select: { id: true, firstName: true, lastName: true, empCode: true },
  });
  const byId = new Map(emps.map((e) => [e.id, e]));
  return reqs.map((r) => ({ ...r, employee: byId.get(r.employeeId) ?? null }));
}

export async function decideChangeRequest(
  id: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:approve")) return { success: false, error: "Not authorized." };

  const req = await prisma.employeeChangeRequest.findUnique({ where: { id } });
  if (!req || req.status !== "PENDING") return { success: false, error: "Request not found or already decided." };

  await prisma.$transaction(async (tx) => {
    if (decision === "APPROVED") {
      const changes = req.changes as Record<string, { to: string }>;
      const data: Prisma.EmployeeUpdateInput = {};
      for (const [field, val] of Object.entries(changes)) {
        if (field === "phone") data.phone = val.to || null;
        else if (field === "personalEmail") data.personalEmail = val.to || null;
        else if (field === "workLocation") data.workLocation = val.to || null;
      }
      await tx.employee.update({ where: { id: req.employeeId }, data });
    }
    await tx.employeeChangeRequest.update({
      where: { id },
      data: { status: decision, reviewedBy: u!.id, reviewedAt: new Date(), reviewNote: reviewNote || null },
    });
    await tx.activityLog.create({
      data: {
        action: decision === "APPROVED" ? "PROFILE_CHANGE_APPROVED" : "PROFILE_CHANGE_REJECTED",
        entityType: "EMPLOYEE", entityId: req.employeeId, userId: u!.id,
        changes: req.changes as Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath("/people/requests");
  revalidatePath(`/people/${req.employeeId}`);
  return { success: true, data: { id } };
}
