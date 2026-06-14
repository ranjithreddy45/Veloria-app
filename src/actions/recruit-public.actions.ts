"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ============================================================
// Public recruitment actions — power the PUBLIC /careers site.
// NO auth: these are intentionally reachable without a session
// (the /careers route is not in middleware INTERNAL_ROUTES).
// Only async exports allowed in a "use server" module.
// ============================================================

type Result<T> = { success: true; data: T } | { success: false; error: string };

export type OpenRole = {
  id: string;
  title: string;
  department: string | null;
  city: string | null;
  positions: number;
  description: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function shortDescription(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177).trimEnd()}…`;
}

// Public list of live openings (status = IN_PROGRESS).
export async function getOpenRoles(): Promise<OpenRole[]> {
  const openings = await prisma.recJobOpening.findMany({
    where: { status: "IN_PROGRESS" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      postingTitle: true,
      department: true,
      city: true,
      numberOfPositions: true,
      description: true,
    },
  });

  return openings.map((o) => ({
    id: o.id,
    title: o.postingTitle,
    department: o.department,
    city: o.city,
    positions: o.numberOfPositions,
    description: shortDescription(o.description),
  }));
}

// Public single role (for /careers/[id]) — only if it's an open posting.
export async function getOpenRole(id: string): Promise<OpenRole | null> {
  if (!id?.trim()) return null;
  const o = await prisma.recJobOpening.findFirst({
    where: { id, status: "IN_PROGRESS" },
    select: {
      id: true,
      postingTitle: true,
      department: true,
      city: true,
      numberOfPositions: true,
      description: true,
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    title: o.postingTitle,
    department: o.department,
    city: o.city,
    positions: o.numberOfPositions,
    description: o.description,
  };
}

export type ApplyInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  city?: string;
};

// Public apply flow. Creates (or reuses) a RecCandidate sourced from the
// career site and links a RecApplication in SCREENING. Idempotent-ish:
// reuses an existing candidate by email and relies on the
// @@unique([candidateId, jobOpeningId]) to block duplicate applications.
export async function applyToRole(
  jobOpeningId: string,
  input: ApplyInput,
): Promise<Result<{ applicationId: string }>> {
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim() || null;
  const city = input.city?.trim() || null;

  // Basic validation.
  if (!firstName) return { success: false, error: "First name is required." };
  if (!lastName) return { success: false, error: "Last name is required." };
  if (!email) return { success: false, error: "Email is required." };
  if (!EMAIL_RE.test(email)) return { success: false, error: "Please enter a valid email address." };

  // Role must exist and be open.
  const role = await prisma.recJobOpening.findFirst({
    where: { id: jobOpeningId, status: "IN_PROGRESS" },
    select: { id: true },
  });
  if (!role) return { success: false, error: "This role is no longer accepting applications." };

  // Reuse an existing candidate by email, otherwise create one.
  const existing = email
    ? await prisma.recCandidate.findFirst({ where: { email }, select: { id: true } })
    : null;

  let candidateId: string;
  if (existing) {
    candidateId = existing.id;
    // Keep their details fresh from the latest application.
    await prisma.recCandidate.update({
      where: { id: existing.id },
      data: {
        firstName,
        lastName,
        ...(phone ? { phone } : {}),
        ...(city ? { city } : {}),
      },
    });
  } else {
    const candidate = await prisma.recCandidate.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        city,
        source: "Career site",
        stage: "NEW",
      },
      select: { id: true },
    });
    candidateId = candidate.id;
  }

  // Link the application (SCREENING). Duplicate → friendly "already applied".
  try {
    const application = await prisma.recApplication.create({
      data: { candidateId, jobOpeningId, stage: "SCREENING" },
      select: { id: true },
    });
    return { success: true, data: { applicationId: application.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { success: false, error: "You've already applied to this role — we have your application." };
    }
    return { success: false, error: "Something went wrong submitting your application. Please try again." };
  }
}
