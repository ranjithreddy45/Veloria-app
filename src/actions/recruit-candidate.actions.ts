"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Recruitment — Candidate Detail actions (interviews + offers).
// New file (recruit.actions.ts is off-limits). All Rec* models use
// relationless string FKs, so names/titles are resolved via small lookups.
// ============================================================

type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const INTERVIEW_MODES = ["IN_PERSON", "VIDEO", "PHONE"] as const;
type InterviewMode = (typeof INTERVIEW_MODES)[number];

const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

const OFFER_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "WITHDRAWN"] as const;
type OfferStatus = (typeof OFFER_STATUSES)[number];

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

// ============================================================
// Read — candidate + applications + interviews + offers.
// ============================================================
export async function getCandidateDetail(id: string) {
  const u = await requireUser();
  if (!canRead(u?.role)) return null;

  const candidate = await prisma.recCandidate.findUnique({ where: { id } });
  if (!candidate) return null;

  const [applications, interviews, offers] = await Promise.all([
    prisma.recApplication.findMany({
      where: { candidateId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recInterview.findMany({
      where: { candidateId: id },
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.recOffer.findMany({
      where: { candidateId: id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Resolve job titles + interviewer/user names with small lookups.
  const jobIds = new Set<string>();
  for (const a of applications) jobIds.add(a.jobOpeningId);
  for (const o of offers) if (o.jobOpeningId) jobIds.add(o.jobOpeningId);

  const userIds = new Set<string>();
  for (const iv of interviews) if (iv.interviewerId) userIds.add(iv.interviewerId);

  const [jobs, users] = await Promise.all([
    jobIds.size
      ? prisma.recJobOpening.findMany({
          where: { id: { in: [...jobIds] } },
          select: { id: true, postingTitle: true },
        })
      : Promise.resolve([]),
    userIds.size
      ? prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const jobTitle = new Map(jobs.map((j) => [j.id, j.postingTitle]));
  const userName = new Map(users.map((x) => [x.id, x.name ?? "—"]));

  return {
    candidate: {
      id: candidate.id,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      name: `${candidate.firstName} ${candidate.lastName}`.trim(),
      email: candidate.email,
      phone: candidate.phone,
      city: candidate.city,
      source: candidate.source,
      rating: candidate.rating,
      stage: candidate.stage,
      notes: candidate.notes,
    },
    applications: applications.map((a) => ({
      id: a.id,
      jobOpeningId: a.jobOpeningId,
      jobTitle: jobTitle.get(a.jobOpeningId) ?? "Unknown role",
      stage: a.stage,
    })),
    interviews: interviews.map((iv) => ({
      id: iv.id,
      applicationId: iv.applicationId,
      round: iv.round,
      mode: iv.mode,
      scheduledAt: iso(iv.scheduledAt)!,
      interviewerId: iv.interviewerId,
      interviewerName: iv.interviewerId ? userName.get(iv.interviewerId) ?? null : null,
      status: iv.status,
      rating: iv.rating,
      feedback: iv.feedback,
    })),
    offers: offers.map((o) => ({
      id: o.id,
      jobOpeningId: o.jobOpeningId,
      jobTitle: o.jobOpeningId ? jobTitle.get(o.jobOpeningId) ?? null : null,
      ctc: Number(o.ctc),
      joiningDate: iso(o.joiningDate),
      status: o.status,
      notes: o.notes,
    })),
    // Job openings for the "Create offer" dialog selector.
    jobOptions: applications.map((a) => ({
      id: a.jobOpeningId,
      title: jobTitle.get(a.jobOpeningId) ?? "Unknown role",
    })),
  };
}

// ============================================================
// Interviews
// ============================================================
export async function scheduleInterview(input: {
  candidateId: string;
  applicationId?: string;
  round: string;
  mode: string;
  scheduledAt: string;
  interviewerId?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const round = input.round.trim();
  if (!round) return { success: false, error: "Round is required." };
  const mode = (INTERVIEW_MODES as readonly string[]).includes(input.mode)
    ? (input.mode as InterviewMode)
    : "VIDEO";
  const when = new Date(input.scheduledAt);
  if (isNaN(when.getTime())) return { success: false, error: "Invalid date/time." };

  try {
    const created = await prisma.recInterview.create({
      data: {
        candidateId: input.candidateId,
        applicationId: input.applicationId || null,
        round,
        mode,
        scheduledAt: when,
        interviewerId: input.interviewerId || null,
        createdById: u?.id,
      },
      select: { id: true },
    });
    revalidatePath(`/recruitment/candidates/${input.candidateId}`);
    return { success: true, data: created };
  } catch {
    return { success: false, error: "Could not schedule interview." };
  }
}

export async function setInterviewOutcome(
  id: string,
  input: { status: string; rating?: number; feedback?: string }
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const status = (INTERVIEW_STATUSES as readonly string[]).includes(input.status)
    ? (input.status as InterviewStatus)
    : null;
  if (!status) return { success: false, error: "Invalid status." };

  try {
    const existing = await prisma.recInterview.findUnique({
      where: { id },
      select: { candidateId: true },
    });
    if (!existing) return { success: false, error: "Interview not found." };

    await prisma.recInterview.update({
      where: { id },
      data: {
        status,
        rating:
          typeof input.rating === "number"
            ? Math.max(0, Math.min(5, Math.round(input.rating)))
            : undefined,
        feedback: input.feedback !== undefined ? input.feedback : undefined,
      },
    });
    revalidatePath(`/recruitment/candidates/${existing.candidateId}`);
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not update interview." };
  }
}

// ============================================================
// Offers
// ============================================================
export async function createOffer(input: {
  candidateId: string;
  jobOpeningId?: string;
  ctc: number;
  joiningDate?: string;
  notes?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const ctc = Number(input.ctc);
  if (!isFinite(ctc) || ctc <= 0) return { success: false, error: "Enter a valid CTC." };

  let joiningDate: Date | null = null;
  if (input.joiningDate) {
    const d = new Date(input.joiningDate);
    if (isNaN(d.getTime())) return { success: false, error: "Invalid joining date." };
    joiningDate = d;
  }

  try {
    const created = await prisma.recOffer.create({
      data: {
        candidateId: input.candidateId,
        jobOpeningId: input.jobOpeningId || null,
        ctc,
        joiningDate,
        notes: input.notes?.trim() || null,
        createdById: u?.id,
      },
      select: { id: true },
    });
    revalidatePath(`/recruitment/candidates/${input.candidateId}`);
    return { success: true, data: created };
  } catch {
    return { success: false, error: "Could not create offer." };
  }
}

export async function setOfferStatus(
  id: string,
  status: string
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  const next = (OFFER_STATUSES as readonly string[]).includes(status)
    ? (status as OfferStatus)
    : null;
  if (!next) return { success: false, error: "Invalid status." };

  try {
    const existing = await prisma.recOffer.findUnique({
      where: { id },
      select: { candidateId: true },
    });
    if (!existing) return { success: false, error: "Offer not found." };

    await prisma.recOffer.update({ where: { id }, data: { status: next } });
    revalidatePath(`/recruitment/candidates/${existing.candidateId}`);
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not update offer." };
  }
}

// ============================================================
// Candidate notes
// ============================================================
export async function updateCandidateNotes(
  id: string,
  notes: string
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  try {
    await prisma.recCandidate.update({
      where: { id },
      data: { notes: notes.trim() || null },
    });
    revalidatePath(`/recruitment/candidates/${id}`);
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not save notes." };
  }
}
