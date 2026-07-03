"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { Prisma } from "@prisma/client";
import { REC_APP_STAGES, REC_CANDIDATE_STAGES, REC_JOB_STATUSES } from "@/lib/recruit/constants";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string };
}
const canRead = (r?: string) => !!r && hasPermission(r, "recruit:read");
const canWrite = (r?: string) => !!r && hasPermission(r, "recruit:write");

const DAY = 86_400_000;
async function userMap(): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name ?? "—"]));
}

// ============================================================
// Dashboard — Hiring Pipeline matrix + time-to-fill / time-to-hire.
// ============================================================
export async function getRecruitDashboard() {
  const u = await requireUser();
  if (!canRead(u?.role)) return null;

  const openings = await prisma.recJobOpening.findMany({
    where: { status: { notIn: ["CANCELLED"] } },
    include: { applications: { select: { stage: true } } },
    orderBy: { createdAt: "desc" },
  });

  const pipeline = openings.map((o) => {
    const counts: Record<string, number> = {};
    for (const s of REC_APP_STAGES) counts[s] = 0;
    for (const a of o.applications) counts[a.stage] = (counts[a.stage] ?? 0) + 1;
    return {
      id: o.id, postingTitle: o.postingTitle, department: o.department,
      positions: o.numberOfPositions, counts,
    };
  });

  // Time-to-fill: FILLED openings, createdAt → filledAt (days).
  const filled = await prisma.recJobOpening.findMany({ where: { status: "FILLED", filledAt: { not: null } }, select: { id: true, postingTitle: true, createdAt: true, filledAt: true } });
  const ttfRows = filled.map((o) => ({ id: o.id, title: o.postingTitle, days: Math.round((o.filledAt!.getTime() - o.createdAt.getTime()) / DAY) }));
  const ttfAvg = ttfRows.length ? Math.round(ttfRows.reduce((s, r) => s + r.days, 0) / ttfRows.length) : null;

  // Time-to-hire: HIRED applications, candidate.createdAt → application.updatedAt (days).
  const hired = await prisma.recApplication.findMany({
    where: { stage: "HIRED" },
    include: { candidate: { select: { firstName: true, lastName: true, createdAt: true } }, jobOpening: { select: { postingTitle: true } } },
  });
  const tthRows = hired.map((a) => ({
    id: a.id,
    candidate: `${a.candidate.firstName} ${a.candidate.lastName}`,
    job: a.jobOpening.postingTitle,
    days: Math.max(0, Math.round((a.updatedAt.getTime() - a.candidate.createdAt.getTime()) / DAY)),
  }));
  const tthAvg = tthRows.length ? Math.round(tthRows.reduce((s, r) => s + r.days, 0) / tthRows.length) : null;

  return {
    pipeline,
    stages: [...REC_APP_STAGES] as string[],
    timeToFill: { avg: ttfAvg, rows: ttfRows.slice(0, 8) },
    timeToHire: { avg: tthAvg, rows: tthRows.slice(0, 8) },
    totals: {
      openings: openings.length,
      activeOpenings: openings.filter((o) => o.status === "IN_PROGRESS").length,
      applications: openings.reduce((s, o) => s + o.applications.length, 0),
    },
  };
}

// ============================================================
// Job openings
// ============================================================
export async function getJobOpenings() {
  const u = await requireUser();
  if (!canRead(u?.role)) return [];
  const [openings, names] = await Promise.all([
    prisma.recJobOpening.findMany({ include: { _count: { select: { applications: true } } }, orderBy: { createdAt: "desc" } }),
    userMap(),
  ]);
  return openings.map((o) => ({
    id: o.id, postingTitle: o.postingTitle, department: o.department, city: o.city,
    status: o.status, numberOfPositions: o.numberOfPositions,
    targetDate: o.targetDate ? o.targetDate.toISOString() : null,
    hiringManager: o.hiringManagerId ? names.get(o.hiringManagerId) ?? null : null,
    assignedRecruiter: o.assignedRecruiterId ? names.get(o.assignedRecruiterId) ?? null : null,
    applications: o._count.applications,
    createdAt: o.createdAt.toISOString(),
  }));
}

// Job detail — the opening plus every candidate linked to it (via applications).
// Powers the Job → Candidates cross-navigation on /recruitment/jobs/[id].
export async function getJobOpeningDetail(id: string) {
  const u = await requireUser();
  if (!canRead(u?.role)) return null;

  const opening = await prisma.recJobOpening.findUnique({ where: { id } });
  if (!opening) return null;

  const [applications, names] = await Promise.all([
    prisma.recApplication.findMany({
      where: { jobOpeningId: id },
      include: {
        candidate: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, city: true, rating: true, stage: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    userMap(),
  ]);

  return {
    opening: {
      id: opening.id,
      postingTitle: opening.postingTitle,
      department: opening.department,
      city: opening.city,
      status: opening.status as string,
      numberOfPositions: opening.numberOfPositions,
      description: opening.description,
      targetDate: opening.targetDate ? opening.targetDate.toISOString() : null,
      hiringManager: opening.hiringManagerId ? names.get(opening.hiringManagerId) ?? null : null,
      assignedRecruiter: opening.assignedRecruiterId ? names.get(opening.assignedRecruiterId) ?? null : null,
      createdAt: opening.createdAt.toISOString(),
    },
    candidates: applications.map((a) => ({
      applicationId: a.id,
      applicationStage: a.stage as string,
      applicationRating: a.rating,
      id: a.candidate.id,
      name: `${a.candidate.firstName} ${a.candidate.lastName}`.trim(),
      email: a.candidate.email,
      phone: a.candidate.phone,
      city: a.candidate.city,
      rating: a.candidate.rating,
      stage: a.candidate.stage as string,
    })),
  };
}

export async function createJobOpening(input: {
  postingTitle: string; department?: string; city?: string; numberOfPositions?: number;
  targetDate?: string; hiringManagerId?: string; assignedRecruiterId?: string; description?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.postingTitle?.trim()) return { success: false, error: "Posting title is required." };
  const o = await prisma.recJobOpening.create({
    data: {
      postingTitle: input.postingTitle.trim(), department: input.department?.trim() || null, city: input.city?.trim() || null,
      numberOfPositions: input.numberOfPositions && input.numberOfPositions > 0 ? input.numberOfPositions : 1,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
      hiringManagerId: input.hiringManagerId || null, assignedRecruiterId: input.assignedRecruiterId || null,
      description: input.description?.trim() || null, createdById: u!.id,
    },
  });
  revalidatePath("/recruitment/jobs");
  return { success: true, data: { id: o.id } };
}

export async function setJobStatus(id: string, status: string): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };
  if (!(REC_JOB_STATUSES as readonly string[]).includes(status)) return { success: false, error: "Invalid status." };
  const exists = await prisma.recJobOpening.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { success: false, error: "Job opening not found." };
  await prisma.recJobOpening.update({
    where: { id },
    // Only stamp filledAt when filling; leave it untouched on other transitions
    // so historical time-to-fill data survives an ON_HOLD/INACTIVE move.
    data: { status: status as Prisma.RecJobOpeningUpdateInput["status"], ...(status === "FILLED" ? { filledAt: new Date() } : {}) },
  });
  revalidatePath("/recruitment/jobs");
  revalidatePath("/recruitment");
  return { success: true, data: { ok: true } };
}

// ============================================================
// Candidates
// ============================================================
export async function getCandidates() {
  const u = await requireUser();
  if (!canRead(u?.role)) return { rows: [], stageCounts: {} as Record<string, number> };
  const [cands, names] = await Promise.all([
    prisma.recCandidate.findMany({ orderBy: { updatedAt: "desc" }, take: 300 }),
    userMap(),
  ]);
  const stageCounts: Record<string, number> = {};
  for (const s of REC_CANDIDATE_STAGES) stageCounts[s] = 0;
  for (const c of cands) stageCounts[c.stage] = (stageCounts[c.stage] ?? 0) + 1;
  return {
    rows: cands.map((c) => ({
      id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, phone: c.phone, city: c.city,
      source: c.source, rating: c.rating, stage: c.stage,
      owner: c.ownerId ? names.get(c.ownerId) ?? null : null,
      modifiedAt: c.updatedAt.toISOString(),
    })),
    stageCounts,
  };
}

export async function createCandidate(input: {
  firstName: string; lastName?: string; email?: string; phone?: string; city?: string; source?: string;
}): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };
  if (!input.firstName?.trim()) return { success: false, error: "Name is required." };
  const c = await prisma.recCandidate.create({
    data: {
      firstName: input.firstName.trim(), lastName: input.lastName?.trim() || "",
      email: input.email?.trim() || null, phone: input.phone?.trim() || null, city: input.city?.trim() || null,
      source: input.source?.trim() || "Direct", ownerId: u!.id, createdById: u!.id,
    },
  });
  revalidatePath("/recruitment/candidates");
  return { success: true, data: { id: c.id } };
}

export async function setCandidateStage(id: string, stage: string): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };
  if (!(REC_CANDIDATE_STAGES as readonly string[]).includes(stage)) return { success: false, error: "Invalid stage." };
  const exists = await prisma.recCandidate.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { success: false, error: "Candidate not found." };
  await prisma.recCandidate.update({ where: { id }, data: { stage: stage as Prisma.RecCandidateUpdateInput["stage"] } });
  revalidatePath("/recruitment/candidates");
  return { success: true, data: { ok: true } };
}

// ============================================================
// Applications (candidate × opening)
// ============================================================
export async function getApplications() {
  const u = await requireUser();
  if (!canRead(u?.role)) return [];
  const apps = await prisma.recApplication.findMany({
    include: { candidate: { select: { firstName: true, lastName: true } }, jobOpening: { select: { postingTitle: true } } },
    orderBy: { updatedAt: "desc" }, take: 300,
  });
  return apps.map((a) => ({
    id: a.id,
    name: `${a.candidate.firstName} ${a.candidate.lastName} — ${a.jobOpening.postingTitle}`,
    candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`.trim(),
    postingTitle: a.jobOpening.postingTitle,
    stage: a.stage, rating: a.rating,
    candidateId: a.candidateId, jobOpeningId: a.jobOpeningId,
    modifiedAt: a.updatedAt.toISOString(),
  }));
}

export async function setApplicationStage(id: string, stage: string): Promise<Result<{ ok: true }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };
  if (!(REC_APP_STAGES as readonly string[]).includes(stage)) return { success: false, error: "Invalid stage." };
  const exists = await prisma.recApplication.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { success: false, error: "Application not found." };
  await prisma.recApplication.update({ where: { id }, data: { stage: stage as Prisma.RecApplicationUpdateInput["stage"] } });
  revalidatePath("/recruitment/applications");
  revalidatePath("/recruitment");
  return { success: true, data: { ok: true } };
}

// Options for create forms.
export async function getRecruitFormOptions() {
  const u = await requireUser();
  if (!canRead(u?.role)) return { users: [], openings: [], candidates: [] };
  const [users, openings, candidates] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.recJobOpening.findMany({ where: { status: { in: ["IN_PROGRESS", "ON_HOLD"] } }, select: { id: true, postingTitle: true }, orderBy: { createdAt: "desc" } }),
    prisma.recCandidate.findMany({ select: { id: true, firstName: true, lastName: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);
  return {
    users: users.map((u2) => ({ id: u2.id, name: u2.name ?? "—" })),
    openings: openings.map((o) => ({ id: o.id, title: o.postingTitle })),
    candidates: candidates.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim() })),
  };
}

// Create an application. Either pass an existing `candidateId`, or pass a typed
// `candidateName` (free text) — in which case a lightweight candidate record is
// created on the fly and linked. This lets recruiters add an applicant by name
// without pre-registering them in the talent pool first.
export async function createApplication(
  candidateIdOrOpts: string | { candidateId?: string; candidateName?: string; jobOpeningId: string },
  jobOpeningIdArg?: string,
): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };

  // Backwards-compatible: positional (candidateId, jobOpeningId) OR an options object.
  const opts =
    typeof candidateIdOrOpts === "string"
      ? { candidateId: candidateIdOrOpts, jobOpeningId: jobOpeningIdArg ?? "" }
      : candidateIdOrOpts;

  const jobOpeningId = opts.jobOpeningId;
  const typedName = opts.candidateName?.trim();
  if (!jobOpeningId) return { success: false, error: "Pick a job opening." };
  if (!opts.candidateId && !typedName)
    return { success: false, error: "Pick a candidate or type an applicant name." };

  try {
    const opening = await prisma.recJobOpening.findUnique({ where: { id: jobOpeningId }, select: { id: true } });
    if (!opening) return { success: false, error: "That job opening no longer exists." };

    // Resolve the candidate: an explicit pick wins; otherwise create from the typed name.
    let candidateId = opts.candidateId;
    if (candidateId) {
      const candidate = await prisma.recCandidate.findUnique({ where: { id: candidateId }, select: { id: true } });
      if (!candidate) return { success: false, error: "That candidate no longer exists." };
    } else {
      const parts = typedName!.split(/\s+/).filter(Boolean);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");
      const c = await prisma.recCandidate.create({
        data: { firstName, lastName, source: "Direct", ownerId: u!.id, createdById: u!.id },
      });
      candidateId = c.id;
    }

    const a = await prisma.recApplication.create({ data: { candidateId, jobOpeningId, createdById: u!.id } });
    revalidatePath("/recruitment/applications");
    revalidatePath("/recruitment/candidates");
    return { success: true, data: { id: a.id } };
  } catch {
    return { success: false, error: "That candidate is already on this opening." };
  }
}

// ============================================================
// Demo seed (admin) — a realistic pipeline so the screens aren't empty.
// ============================================================
export async function seedRecruitDemo(): Promise<Result<{ openings: number; candidates: number; applications: number }>> {
  const u = await requireUser();
  if (!canWrite(u?.role)) return { success: false, error: "Not authorized." };
  const existing = await prisma.recJobOpening.count();
  if (existing > 0) return { success: false, error: "Recruitment already has data." };

  const JOBS = [
    { postingTitle: "Senior Sales / BD Manager", department: "Sales", numberOfPositions: 2, city: "Bengaluru", status: "IN_PROGRESS" as const, days: 40 },
    { postingTitle: "Performance Marketing Manager", department: "Marketing", numberOfPositions: 1, city: "Bengaluru", status: "IN_PROGRESS" as const, days: 25 },
    { postingTitle: "SEO Head", department: "Marketing", numberOfPositions: 1, city: "Hyderabad", status: "IN_PROGRESS" as const, days: 15 },
    { postingTitle: "Event Operations Lead", department: "Operations", numberOfPositions: 1, city: "Bengaluru", status: "FILLED" as const, days: 60 },
  ];
  const CANDS = [
    ["Karthik", "Kumar", "Bengaluru", "Referral"], ["Santhosh", "Raj", "Bangalore", "LinkedIn"],
    ["Simhadri", "Venkata", "Bangalore", "Career site"], ["Akshay", "Naik", "Bengaluru", "Referral"],
    ["Anuj", "Kishore", "Bengaluru", "LinkedIn"], ["Vivek", "Krishna", "Coimbatore", "Naukri"],
    ["Gagan", "Shivanna", "Bengaluru", "Career site"], ["Nathaniel", "Anthony", "Chennai", "Referral"],
  ];
  const APP_STAGES = ["SCREENING", "SUBMISSIONS", "INTERVIEW", "OFFERED", "HIRED", "REJECTED", "ARCHIVED"] as const;

  let openings = 0, candidates = 0, applications = 0;
  const now = Date.now();
  const jobIds: string[] = [];
  for (const j of JOBS) {
    const created = new Date(now - j.days * DAY);
    const o = await prisma.recJobOpening.create({
      data: {
        postingTitle: j.postingTitle, department: j.department, city: j.city, numberOfPositions: j.numberOfPositions,
        status: j.status, targetDate: new Date(now + 30 * DAY), createdById: u!.id, createdAt: created,
        filledAt: j.status === "FILLED" ? new Date(now - 5 * DAY) : null,
        hiringManagerId: u!.id, assignedRecruiterId: u!.id,
      },
    });
    jobIds.push(o.id); openings++;
  }
  const candIds: string[] = [];
  for (let i = 0; i < CANDS.length; i++) {
    const [fn, ln, city, source] = CANDS[i];
    const c = await prisma.recCandidate.create({
      data: {
        firstName: fn, lastName: ln, city, source, rating: (i % 5),
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
        stage: REC_CANDIDATE_STAGES[i % REC_CANDIDATE_STAGES.length], ownerId: u!.id, createdById: u!.id,
        createdAt: new Date(now - (CANDS.length - i) * 3 * DAY),
      },
    });
    candIds.push(c.id); candidates++;
  }
  // Spread applications across the main opening + stages.
  for (let i = 0; i < candIds.length; i++) {
    const jobId = jobIds[i % 2]; // mostly the two active sales/marketing roles
    try {
      await prisma.recApplication.create({ data: { candidateId: candIds[i], jobOpeningId: jobId, stage: APP_STAGES[i % APP_STAGES.length], createdById: u!.id } });
      applications++;
    } catch { /* dup */ }
  }
  revalidatePath("/recruitment");
  return { success: true, data: { openings, candidates, applications } };
}
