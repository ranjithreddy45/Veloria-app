"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { createEmployee } from "@/actions/hr-employee.actions";
import { startOnboarding } from "@/actions/hr-journey.actions";

// ============================================================
// Recruitment → HR handoff.
// One-click "Create employee from candidate": a HIRED candidate (or one
// with a HIRED offer / linked HIRED application) is materialised into an
// HR Employee. Field mapping is delegated to createEmployee (hr-employee
// .actions) so we don't fork the Employee create logic. Rec* models use
// relationless string FKs, so job/department lookups are done by hand.
// "use server" → every export must be async.
// ============================================================

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}

// HR write gate (hr:admin implies write — both grant the create path).
function canHrWrite(role?: string) {
  return !!role && (hasPermission(role, "hr:write") || hasPermission(role, "hr:admin"));
}

// Split a candidate's first/last into the Employee's required two fields.
// Employee requires BOTH firstName + lastName (non-null), so fall back to a
// placeholder rather than letting the downstream create reject an empty last.
function splitName(firstName: string, lastName: string) {
  const first = firstName?.trim() || "";
  const last = lastName?.trim() || "";
  if (first && last) return { firstName: first, lastName: last };
  // Single combined token (e.g. lastName empty) → try to split on whitespace.
  const combined = `${first} ${last}`.trim();
  const parts = combined.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  return { firstName: parts[0] || "Candidate", lastName: "—" };
}

// ============================================================
// createEmployeeFromCandidate
// Requires the candidate to be HIRED (stage) OR have a HIRED application
// OR an ACCEPTED offer. RBAC: hr:write / hr:admin. Idempotent on email.
// Returns the (new or existing) employee id.
// ============================================================
export async function createEmployeeFromCandidate(
  candidateId: string
): Promise<Result<{ employeeId: string; created: boolean }>> {
  const u = await requireUser();
  if (!canHrWrite(u?.role)) return { success: false, error: "Not authorized." };

  const candidate = await prisma.recCandidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return { success: false, error: "Candidate not found." };

  // --- HIRED gate: stage HIRED, or a HIRED application, or an ACCEPTED offer.
  const [hiredApp, acceptedOffer] = await Promise.all([
    prisma.recApplication.findFirst({
      where: { candidateId, stage: "HIRED" },
      select: { id: true, jobOpeningId: true },
    }),
    prisma.recOffer.findFirst({
      where: { candidateId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, jobOpeningId: true, joiningDate: true, ctc: true },
    }),
  ]);
  const isHired = candidate.stage === "HIRED" || !!hiredApp || !!acceptedOffer;
  if (!isHired) {
    return {
      success: false,
      error: "Candidate must be HIRED (or have an accepted offer) before creating an employee.",
    };
  }

  // --- Idempotency: if an employee already exists for this candidate's email,
  // return it instead of duplicating. (RecCandidate has no employeeId link
  // field, so email is the join key; matches createEmployee's own dedupe.)
  const email = candidate.email?.trim() || null;
  if (email) {
    const existing = await prisma.employee.findFirst({
      where: {
        deletedAt: null,
        OR: [{ workEmail: email }, { personalEmail: email }],
      },
      select: { id: true },
    });
    if (existing) {
      return { success: true, data: { employeeId: existing.id, created: false } };
    }
  }

  // --- Resolve the legal entity. Candidate.entityId holds a LegalEntity
  // shortCode (e.g. "BILLION"); fall back to the first active entity.
  const entity =
    (await prisma.legalEntity.findFirst({
      where: { isActive: true, shortCode: candidate.entityId },
      select: { id: true },
    })) ??
    (await prisma.legalEntity.findFirst({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true },
    }));
  if (!entity) {
    return {
      success: false,
      error: "No legal entity is configured. Seed the HR org foundation first.",
    };
  }

  // --- Resolve department + designation from the linked job opening (the
  // accepted offer's job wins, else the HIRED application's job). Job stores
  // department as a free string + postingTitle; match to HR records by name.
  const jobOpeningId = acceptedOffer?.jobOpeningId || hiredApp?.jobOpeningId || null;
  let departmentId: string | undefined;
  let designationId: string | undefined;
  if (jobOpeningId) {
    const job = await prisma.recJobOpening.findUnique({
      where: { id: jobOpeningId },
      select: { department: true, postingTitle: true },
    });
    if (job?.department?.trim()) {
      const dept = await prisma.department.findFirst({
        where: { isActive: true, name: { equals: job.department.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      departmentId = dept?.id;
    }
    if (job?.postingTitle?.trim()) {
      const desig = await prisma.hrDesignation.findFirst({
        where: { isActive: true, name: { equals: job.postingTitle.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      designationId = desig?.id;
    }
  }

  const { firstName, lastName } = splitName(candidate.firstName, candidate.lastName);
  const joiningDate = acceptedOffer?.joiningDate
    ? acceptedOffer.joiningDate.toISOString()
    : undefined;

  // --- Delegate the actual create (empCode, audit log, validation, dedupe)
  // to the canonical HR action. CTC (Decimal) is informational only — the
  // Employee model has no CTC column — so it is recorded in notes as Number.
  const ctcNote = acceptedOffer ? `Offered CTC: ${Number(acceptedOffer.ctc)}` : null;
  const res = await createEmployee({
    firstName,
    lastName,
    workEmail: email || undefined,
    phone: candidate.phone?.trim() || undefined,
    legalEntityId: entity.id,
    departmentId,
    designationId,
    dateOfJoining: joiningDate,
    status: "ONBOARDING",
  });
  if (!res.success) return res;

  const employeeId = res.data.id;

  // Persist the CTC + source candidate on the new employee record (notes),
  // since there is no dedicated link/CTC field on Employee.
  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      notes: [`Created from recruitment candidate ${candidateId}.`, ctcNote]
        .filter(Boolean)
        .join(" "),
    },
  });

  // Best-effort: kick off the standard onboarding journey. Never fail the
  // handoff if onboarding can't start (e.g. one already in progress).
  await startOnboarding(employeeId, joiningDate).catch(() => undefined);

  revalidatePath(`/recruitment/candidates/${candidateId}`);
  revalidatePath("/people");
  return { success: true, data: { employeeId, created: true } };
}
