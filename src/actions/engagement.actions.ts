"use server";

// ============================================================
// Engagement — pulse surveys / eNPS.
// Any signed-in user can answer an active pulse (1–5 + optional comment);
// managers create/close surveys and read results. Results are ANONYMISED:
// comments are returned as free text + score only, never tied to a user.
// Additive — uses the existing PulseSurvey / PulseResponse tables.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const ENGAGEMENT_PATH = "/people/engagement";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; name?: string | null; role?: string };
}

// Who can create / close surveys and read results.
function canManage(role: string | undefined | null): boolean {
  if (!role) return false;
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  return hasPermission(role, "hr:write") || hasPermission(role, "hr:admin");
}

export interface ActiveSurveyForMe {
  id: string;
  title: string;
  question: string;
  createdAt: string;
  myResponse: { score: number; comment: string | null } | null;
}

// ------------------------------------------------------------
// Active surveys for the current user + their existing response (if any).
// ------------------------------------------------------------
export async function getActiveSurveysForMe(): Promise<Result<ActiveSurveyForMe[]>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const surveys = await prisma.pulseSurvey.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      responses: {
        where: { userId: user.id },
        select: { score: true, comment: true },
        take: 1,
      },
    },
  });

  const data: ActiveSurveyForMe[] = surveys.map((s) => ({
    id: s.id,
    title: s.title,
    question: s.question,
    createdAt: s.createdAt.toISOString(),
    myResponse: s.responses[0]
      ? { score: s.responses[0].score, comment: s.responses[0].comment }
      : null,
  }));

  return { success: true, data };
}

// ------------------------------------------------------------
// Respond to a pulse — any signed-in user, upsert on (surveyId, userId).
// ------------------------------------------------------------
export async function respondToSurvey(
  surveyId: string,
  input: { score: number; comment?: string | null }
): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!surveyId) return { success: false, error: "Missing survey." };

  const score = Math.round(Number(input.score));
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return { success: false, error: "Pick a score from 1 to 5." };
  }
  const comment = input.comment?.trim() || null;

  // Guard: only accept responses to an active survey that exists.
  const survey = await prisma.pulseSurvey.findUnique({
    where: { id: surveyId },
    select: { isActive: true },
  });
  if (!survey) return { success: false, error: "Survey not found." };
  if (!survey.isActive) return { success: false, error: "This survey is closed." };

  const res = await prisma.pulseResponse.upsert({
    where: { surveyId_userId: { surveyId, userId: user.id } },
    create: { surveyId, userId: user.id, score, comment },
    update: { score, comment },
    select: { id: true },
  });

  revalidatePath(ENGAGEMENT_PATH);
  return { success: true, data: { id: res.id } };
}

// ------------------------------------------------------------
// Create a survey — managers only.
// ------------------------------------------------------------
export async function createSurvey(input: {
  title: string;
  question: string;
}): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!canManage(user.role)) return { success: false, error: "Only managers can create surveys." };

  const title = input.title?.trim();
  const question = input.question?.trim();
  if (!title) return { success: false, error: "Add a title." };
  if (!question) return { success: false, error: "Add a question." };

  const survey = await prisma.pulseSurvey.create({
    data: { title, question, createdById: user.id, isActive: true },
    select: { id: true },
  });

  revalidatePath(ENGAGEMENT_PATH);
  return { success: true, data: { id: survey.id } };
}

// ------------------------------------------------------------
// Close / reopen a survey — managers only.
// ------------------------------------------------------------
async function setSurveyActive(id: string, isActive: boolean): Promise<Result<{ id: string }>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!canManage(user.role)) return { success: false, error: "Not authorized." };

  const existing = await prisma.pulseSurvey.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, error: "Survey not found." };

  await prisma.pulseSurvey.update({ where: { id }, data: { isActive } });
  revalidatePath(ENGAGEMENT_PATH);
  return { success: true, data: { id } };
}

export async function closeSurvey(id: string): Promise<Result<{ id: string }>> {
  return setSurveyActive(id, false);
}

export async function reopenSurvey(id: string): Promise<Result<{ id: string }>> {
  return setSurveyActive(id, true);
}

export interface SurveyResults {
  id: string;
  title: string;
  question: string;
  isActive: boolean;
  count: number;
  average: number; // 0 when no responses
  distribution: { score: number; count: number }[]; // scores 1..5
  // Anonymised — text + score only, never a userId/name.
  comments: { score: number; comment: string }[];
}

// ------------------------------------------------------------
// Survey results — managers only. Comments are ANONYMISED (no user).
// ------------------------------------------------------------
export async function getSurveyResults(surveyId: string): Promise<Result<SurveyResults>> {
  const user = await requireUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!canManage(user.role)) return { success: false, error: "Not authorized." };

  const survey = await prisma.pulseSurvey.findUnique({
    where: { id: surveyId },
    include: {
      responses: {
        // Deliberately do NOT select userId — keep feedback anonymous.
        select: { score: true, comment: true },
      },
    },
  });
  if (!survey) return { success: false, error: "Survey not found." };

  const responses = survey.responses;
  const count = responses.length;
  const total = responses.reduce((sum, r) => sum + r.score, 0);
  const average = count > 0 ? Math.round((total / count) * 100) / 100 : 0;

  const distribution = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: responses.filter((r) => r.score === score).length,
  }));

  // Anonymise: shuffle so comment order does not mirror response order,
  // and never carry any identity through.
  const comments = responses
    .filter((r) => r.comment && r.comment.trim().length > 0)
    .map((r) => ({ score: r.score, comment: r.comment as string }))
    .sort(() => Math.random() - 0.5);

  const data: SurveyResults = {
    id: survey.id,
    title: survey.title,
    question: survey.question,
    isActive: survey.isActive,
    count,
    average,
    distribution,
    comments,
  };

  return { success: true, data: serialize(data) as SurveyResults };
}

// Expose the manage permission to the UI without leaking the rule.
export async function canCurrentUserManageEngagement(): Promise<boolean> {
  const user = await requireUser();
  return !!user && canManage(user.role);
}
