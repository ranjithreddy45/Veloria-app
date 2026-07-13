"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { isSafeReceiptUrl } from "@/lib/sales/receipt";
import { Prisma } from "@prisma/client";

// ============================================================
// Recruitment — Background Verification (BGV) actions.
// New file (recruit.actions.ts / recruit-candidate.actions.ts are off-limits).
// RecBgvCheck has NO Prisma relation to RecCandidate (relationless string FK),
// so candidate name/email are resolved via small in-memory lookups.
//
// NOTE: "use server" files may export ONLY async functions, so the TYPE/STATUS
// option lists live inline in the client component — not exported from here.
// ============================================================

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const BGV_TYPES = [
  "IDENTITY",
  "EDUCATION",
  "EMPLOYMENT",
  "CRIMINAL",
  "ADDRESS",
  "REFERENCE",
] as const;
type BgvType = (typeof BGV_TYPES)[number];

const BGV_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "CLEARED",
  "FLAGGED",
  "FAILED",
] as const;
type BgvStatus = (typeof BGV_STATUSES)[number];

// Once a check reaches one of these, completedAt is stamped.
const TERMINAL_STATUSES: readonly BgvStatus[] = ["CLEARED", "FLAGGED", "FAILED"];

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canRead = (r?: string) => !!r && hasPermission(r, "recruit:read");
const canWrite = (r?: string) => !!r && hasPermission(r, "recruit:write");

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export interface BgvCheckRow {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  type: string;
  status: string;
  vendor: string | null;
  remarks: string | null;
  attachmentUrl: string | null;
  requestedAt: string;
  completedAt: string | null;
}

// ============================================================
// Read — all checks, joined with candidate name/email.
// Optional filter narrows by candidate / type / status.
// ============================================================
export async function listBgvChecks(filter?: {
  candidateId?: string;
  type?: string;
  status?: string;
}): Promise<BgvCheckRow[]> {
  const u = await requireUser();
  if (!canRead(u?.role)) return [];

  const where: Prisma.RecBgvCheckWhereInput = {};
  if (filter?.candidateId) where.candidateId = filter.candidateId;
  if (filter?.type && (BGV_TYPES as readonly string[]).includes(filter.type)) {
    where.type = filter.type;
  }
  if (filter?.status && (BGV_STATUSES as readonly string[]).includes(filter.status)) {
    where.status = filter.status;
  }

  const checks = await prisma.recBgvCheck.findMany({
    where,
    orderBy: { requestedAt: "desc" },
  });

  // Resolve candidate names/emails in one lookup (no relation to join on).
  const candidateIds = [...new Set(checks.map((c) => c.candidateId))];
  const candidates = candidateIds.length
    ? await prisma.recCandidate.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const nameMap = new Map(
    candidates.map((c) => [
      c.id,
      { name: `${c.firstName} ${c.lastName}`.trim(), email: c.email },
    ])
  );

  return checks.map((c) => {
    const cand = nameMap.get(c.candidateId);
    return {
      id: c.id,
      candidateId: c.candidateId,
      candidateName: cand?.name || "Unknown candidate",
      candidateEmail: cand?.email ?? null,
      type: c.type,
      status: c.status,
      vendor: c.vendor,
      remarks: c.remarks,
      attachmentUrl: c.attachmentUrl,
      requestedAt: iso(c.requestedAt)!,
      completedAt: iso(c.completedAt),
    };
  });
}

// ============================================================
// Read — candidates available to attach a check to.
// ============================================================
export async function listBgvCandidates(): Promise<
  { id: string; name: string; email: string | null; stage: string }[]
> {
  const u = await requireUser();
  if (!canRead(u?.role)) return [];

  const candidates = await prisma.recCandidate.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true, stage: true },
  });
  return candidates.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    stage: c.stage,
  }));
}

// ============================================================
// Create a check.
// ============================================================
export async function createBgvCheck(input: {
  candidateId: string;
  type: string;
  vendor?: string;
  remarks?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const type = (BGV_TYPES as readonly string[]).includes(input.type)
    ? (input.type as BgvType)
    : null;
  if (!type) return { success: false, error: "Invalid check type." };

  const candidate = await prisma.recCandidate.findUnique({
    where: { id: input.candidateId },
    select: { id: true },
  });
  if (!candidate) return { success: false, error: "Candidate not found." };

  try {
    const created = await prisma.recBgvCheck.create({
      data: {
        candidateId: input.candidateId,
        type,
        status: "PENDING",
        vendor: input.vendor?.trim() || null,
        remarks: input.remarks?.trim() || null,
        createdById: u?.id,
      },
      select: { id: true },
    });
    revalidatePath("/recruitment/bgv");
    return { success: true, data: created };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { success: false, error: "Candidate no longer exists." };
    }
    console.error("createBgvCheck failed", e);
    return { success: false, error: "Could not create check." };
  }
}

// ============================================================
// Update a check — status, vendor, remarks, completion, attachment.
// Moving to a terminal state stamps completedAt (now) if not supplied.
// ============================================================
export async function updateBgvCheck(
  id: string,
  input: {
    status: string;
    vendor?: string;
    remarks?: string;
    completedAt?: string;
    attachmentUrl?: string;
  }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const status = (BGV_STATUSES as readonly string[]).includes(input.status)
    ? (input.status as BgvStatus)
    : null;
  if (!status) return { success: false, error: "Invalid status." };

  // Attachment (if supplied) must be a safe image/PDF data-URL or https link.
  let attachmentUrl: string | null | undefined = undefined;
  if (input.attachmentUrl !== undefined) {
    const trimmed = input.attachmentUrl.trim();
    if (trimmed === "") {
      attachmentUrl = null; // explicit clear
    } else if (!isSafeReceiptUrl(trimmed)) {
      return { success: false, error: "Attachment must be an image/PDF file or an https link." };
    } else {
      attachmentUrl = trimmed;
    }
  }

  // Resolve completedAt: explicit value wins; else stamp now on terminal states.
  const isTerminal = TERMINAL_STATUSES.includes(status);
  let completedAt: Date | null | undefined = undefined;
  if (input.completedAt !== undefined) {
    if (input.completedAt === "") {
      completedAt = null;
    } else {
      const d = new Date(input.completedAt);
      if (isNaN(d.getTime())) return { success: false, error: "Invalid completion date." };
      completedAt = d;
    }
  }

  try {
    const existing = await prisma.recBgvCheck.findUnique({
      where: { id },
      select: { completedAt: true },
    });
    if (!existing) return { success: false, error: "Check not found." };

    // If moving to terminal without an explicit date and none on record, stamp now.
    if (isTerminal && completedAt === undefined && !existing.completedAt) {
      completedAt = new Date();
    }
    // Leaving a terminal state (back to PENDING/IN_PROGRESS) clears completion.
    if (!isTerminal && completedAt === undefined) {
      completedAt = null;
    }

    await prisma.recBgvCheck.update({
      where: { id },
      data: {
        status,
        vendor: input.vendor !== undefined ? input.vendor.trim() || null : undefined,
        remarks: input.remarks !== undefined ? input.remarks.trim() || null : undefined,
        completedAt,
        attachmentUrl,
      },
    });
    revalidatePath("/recruitment/bgv");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("updateBgvCheck failed", e);
    return { success: false, error: "Could not update check." };
  }
}

// ============================================================
// Delete a check.
// ============================================================
export async function deleteBgvCheck(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  try {
    const existing = await prisma.recBgvCheck.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) return { success: false, error: "Check not found." };

    await prisma.recBgvCheck.delete({ where: { id } });
    revalidatePath("/recruitment/bgv");
    return { success: true, data: { id } };
  } catch (e) {
    console.error("deleteBgvCheck failed", e);
    return { success: false, error: "Could not delete check." };
  }
}
