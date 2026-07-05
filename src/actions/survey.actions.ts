"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  surveySchema,
  surveyResponseSchema,
  surveyInvitationSchema,
  type SurveyInput,
  type SurveyResponseInput,
  type SurveyInvitationInput,
} from "@/schemas/survey.schema";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";
import { hasPermission } from "@/lib/permissions";

// ============================================================
// Get All Surveys
// ============================================================

export async function getSurveys() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const surveys = await prisma.survey.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });

    return { success: true as const, data: serialize(surveys) };
  } catch (error) {
    console.error("[GET_SURVEYS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch surveys" };
  }
}

// ============================================================
// Get Single Survey
// ============================================================

export async function getSurveyById(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        responses: {
          orderBy: { createdAt: "desc" },
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        },
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });

    if (!survey) {
      return { success: false as const, error: "Survey not found" };
    }

    return { success: true as const, data: serialize(survey) };
  } catch (error) {
    console.error("[GET_SURVEY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch survey" };
  }
}

// ============================================================
// Create Survey (with questions)
// ============================================================

export async function createSurvey(data: SurveyInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = surveySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const surveyData = parsed.data;

    const survey = await prisma.survey.create({
      data: {
        title: surveyData.title,
        description: surveyData.description || null,
        isActive: surveyData.isActive,
        questions: {
          create: surveyData.questions.map((q, index) => ({
            question: q.question,
            type: q.type,
            options: q.options ?? undefined,
            isRequired: q.isRequired,
            order: q.order ?? index,
          })),
        },
      },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "Survey",
      entityId: survey.id,
    });

    revalidatePath("/surveys");
    return { success: true as const, data: serialize(survey) };
  } catch (error) {
    console.error("[CREATE_SURVEY_ERROR]", error);
    return { success: false as const, error: "Failed to create survey" };
  }
}

// ============================================================
// Update Survey
// ============================================================

export async function updateSurvey(id: string, data: SurveyInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = surveySchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.survey.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Survey not found" };
    }

    const surveyData = parsed.data;

    // Optimistic concurrency + atomicity: delete existing questions and
    // recreate them in a single transaction. A conditional updateMany guards
    // against a concurrent edit that mutated the survey after we loaded it —
    // if the row was touched in the meantime (updatedAt changed) the guard
    // matches zero rows and we abort instead of clobbering the other write.
    let survey;
    try {
      survey = await prisma.$transaction(async (tx) => {
        const guard = await tx.survey.updateMany({
          where: { id, updatedAt: existing.updatedAt },
          data: { updatedAt: new Date() },
        });

        if (guard.count === 0) {
          throw new Error("SURVEY_CONCURRENT_MODIFICATION");
        }

        await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });

        return tx.survey.update({
          where: { id },
          data: {
            title: surveyData.title,
            description: surveyData.description || null,
            isActive: surveyData.isActive,
            questions: {
              create: surveyData.questions.map((q, index) => ({
                question: q.question,
                type: q.type,
                options: q.options ?? undefined,
                isRequired: q.isRequired,
                order: q.order ?? index,
              })),
            },
          },
          include: {
            questions: { orderBy: { order: "asc" } },
          },
        });
      });
    } catch (txError) {
      if (
        txError instanceof Error &&
        txError.message === "SURVEY_CONCURRENT_MODIFICATION"
      ) {
        return {
          success: false as const,
          error:
            "This survey was modified by someone else. Please reload and try again.",
        };
      }
      throw txError;
    }

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Survey",
      entityId: survey.id,
    });

    revalidatePath("/surveys");
    revalidatePath(`/surveys/${id}`);
    return { success: true as const, data: serialize(survey) };
  } catch (error) {
    console.error("[UPDATE_SURVEY_ERROR]", error);
    return { success: false as const, error: "Failed to update survey" };
  }
}

// ============================================================
// Delete Survey
// ============================================================

export async function deleteSurvey(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:delete")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.survey.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Survey not found" };
    }

    await prisma.survey.delete({ where: { id } });

    await logActivity({
      userId: session.user.id as string,
      action: "deleted",
      entityType: "Survey",
      entityId: id,
    });

    revalidatePath("/surveys");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_SURVEY_ERROR]", error);
    return { success: false as const, error: "Failed to delete survey" };
  }
}

// ============================================================
// Submit Survey Response (authenticated - from dashboard)
// ============================================================

export async function submitSurveyResponse(data: SurveyResponseInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = surveyResponseSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const responseData = parsed.data;

    const survey = await prisma.survey.findUnique({
      where: { id: responseData.surveyId },
      include: { questions: true },
    });

    if (!survey) {
      return { success: false as const, error: "Survey not found" };
    }

    if (!survey.isActive) {
      return { success: false as const, error: "This survey is no longer active" };
    }

    // M5 anti-poisoning: never attribute a response to an arbitrary
    // booking/contact. Only attribute when the booking really belongs to the
    // given contact; otherwise drop attribution to anonymous so a caller can't
    // poison another customer's NPS/feedback. (Mirrors the public API route.)
    let attribBookingId: string | null = null;
    let attribContactId: string | null = responseData.contactId || null;
    if (responseData.bookingId) {
      const b = await prisma.booking.findUnique({
        where: { id: responseData.bookingId },
        select: { id: true, contactId: true },
      });
      if (b && (!responseData.contactId || b.contactId === responseData.contactId)) {
        attribBookingId = b.id;
        attribContactId = b.contactId;
      } else {
        attribContactId = null; // inconsistent — drop attribution entirely
      }
    }

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: responseData.surveyId,
        bookingId: attribBookingId,
        contactId: attribContactId,
        overallRating: responseData.overallRating ?? null,
        npsScore: responseData.npsScore ?? null,
        answers: {
          create: responseData.answers.map((a) => ({
            questionId: a.questionId,
            value: a.value,
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "SurveyResponse",
      entityId: response.id,
      changes: { surveyId: responseData.surveyId },
    });

    revalidatePath(`/surveys/${responseData.surveyId}`);
    return { success: true as const, data: serialize(response) };
  } catch (error) {
    console.error("[SUBMIT_SURVEY_RESPONSE_ERROR]", error);
    return { success: false as const, error: "Failed to submit response" };
  }
}

// ============================================================
// Get Survey Results (aggregated)
// ============================================================

export async function getSurveyResults(surveyId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Bound the number of responses loaded into memory to avoid memory
    // exhaustion / slow loads on high-volume surveys. Aggregates (rating, NPS,
    // per-question breakdowns) are computed over the most recent sample; the
    // true total is counted separately so the UI can flag truncation.
    const RESPONSE_SAMPLE_LIMIT = 1000;

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { orderBy: { order: "asc" } },
        responses: {
          orderBy: { createdAt: "desc" },
          take: RESPONSE_SAMPLE_LIMIT,
          include: {
            answers: {
              include: {
                question: true,
              },
            },
          },
        },
      },
    });

    if (!survey) {
      return { success: false as const, error: "Survey not found" };
    }

    const totalResponses = await prisma.surveyResponse.count({
      where: { surveyId },
    });
    const sampledResponses = survey.responses.length;
    const truncated = totalResponses > sampledResponses;

    // Calculate average overall rating
    const ratedResponses = survey.responses.filter(
      (r) => r.overallRating !== null
    );
    const averageRating =
      ratedResponses.length > 0
        ? ratedResponses.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) /
          ratedResponses.length
        : null;

    // NPS calculation
    const npsResponses = survey.responses.filter((r) => r.npsScore !== null);
    let npsScore: number | null = null;
    let npsBreakdown = { promoters: 0, passives: 0, detractors: 0 };

    if (npsResponses.length > 0) {
      const promoters = npsResponses.filter(
        (r) => (r.npsScore ?? 0) >= 9
      ).length;
      const detractors = npsResponses.filter(
        (r) => (r.npsScore ?? 0) <= 6
      ).length;
      const passives = npsResponses.length - promoters - detractors;

      npsScore = Math.round(
        ((promoters - detractors) / npsResponses.length) * 100
      );
      npsBreakdown = { promoters, passives, detractors };
    }

    // Per-question breakdown
    const questionResults = survey.questions.map((question) => {
      const answers = survey.responses
        .flatMap((r) => r.answers)
        .filter((a) => a.questionId === question.id);

      if (question.type === "RATING") {
        const numericAnswers = answers
          .map((a) => parseInt(a.value))
          .filter((v) => !isNaN(v));
        const average =
          numericAnswers.length > 0
            ? numericAnswers.reduce((s, v) => s + v, 0) /
              numericAnswers.length
            : 0;
        const distribution: Record<string, number> = {};
        for (let i = 1; i <= 5; i++) {
          distribution[String(i)] = numericAnswers.filter(
            (v) => v === i
          ).length;
        }
        return {
          questionId: question.id,
          question: question.question,
          type: question.type,
          totalAnswers: numericAnswers.length,
          average: Math.round(average * 10) / 10,
          distribution,
        };
      }

      if (question.type === "NPS") {
        const numericAnswers = answers
          .map((a) => parseInt(a.value))
          .filter((v) => !isNaN(v));
        const average =
          numericAnswers.length > 0
            ? numericAnswers.reduce((s, v) => s + v, 0) /
              numericAnswers.length
            : 0;
        return {
          questionId: question.id,
          question: question.question,
          type: question.type,
          totalAnswers: numericAnswers.length,
          average: Math.round(average * 10) / 10,
        };
      }

      if (question.type === "MULTIPLE_CHOICE") {
        const optionCounts: Record<string, number> = {};
        answers.forEach((a) => {
          optionCounts[a.value] = (optionCounts[a.value] ?? 0) + 1;
        });
        return {
          questionId: question.id,
          question: question.question,
          type: question.type,
          totalAnswers: answers.length,
          optionCounts,
        };
      }

      // TEXT type
      return {
        questionId: question.id,
        question: question.question,
        type: question.type,
        totalAnswers: answers.length,
        recentAnswers: answers.slice(0, 10).map((a) => a.value),
      };
    });

    return {
      success: true as const,
      data: serialize({
        surveyId,
        title: survey.title,
        totalResponses,
        sampledResponses,
        truncated,
        averageRating,
        npsScore,
        npsBreakdown,
        questionResults,
      }),
    };
  } catch (error) {
    console.error("[GET_SURVEY_RESULTS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch survey results" };
  }
}

// ============================================================
// Send Survey Invitation (mock)
// ============================================================

export async function sendSurveyInvitation(data: SurveyInvitationInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = surveyInvitationSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const invitationData = parsed.data;

    const survey = await prisma.survey.findUnique({
      where: { id: invitationData.surveyId },
    });

    if (!survey) {
      return { success: false as const, error: "Survey not found" };
    }

    if (!survey.isActive) {
      return { success: false as const, error: "Cannot send invitation for inactive survey" };
    }

    // Mock: In production, this would send an email with a survey link
    const surveyLink = `/portal/surveys/${invitationData.surveyId}`;

    console.log(
      `[MOCK] Survey invitation sent to ${invitationData.email} for survey "${survey.title}" — Link: ${surveyLink}`
    );

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "SurveyInvitation",
      entityId: survey.id,
      changes: {
        email: invitationData.email,
        contactName: invitationData.contactName,
      },
    });

    revalidatePath(`/surveys/${invitationData.surveyId}`);
    return {
      success: true as const,
      data: {
        message: `Survey invitation sent to ${invitationData.email}`,
        surveyLink,
      },
    };
  } catch (error) {
    console.error("[SEND_SURVEY_INVITATION_ERROR]", error);
    return { success: false as const, error: "Failed to send invitation" };
  }
}

// ============================================================
// Toggle Survey Active Status
// ============================================================

export async function toggleSurveyActive(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.survey.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Survey not found" };
    }

    const survey = await prisma.survey.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "status_changed",
      entityType: "Survey",
      entityId: id,
      changes: { isActive: survey.isActive },
    });

    revalidatePath("/surveys");
    revalidatePath(`/surveys/${id}`);
    return { success: true as const, data: serialize(survey) };
  } catch (error) {
    console.error("[TOGGLE_SURVEY_ACTIVE_ERROR]", error);
    return { success: false as const, error: "Failed to toggle survey status" };
  }
}

// ============================================================
// Get Public Survey (no auth — for portal/API)
// ============================================================

export async function getPublicSurvey(surveyId: string) {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId, isActive: true },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!survey) {
      return { success: false as const, error: "Survey not found or inactive" };
    }

    // M5: return ONLY the fields the public feedback form renders. Never
    // serialize the whole record (internal flags, timestamps, and — if the
    // include ever grows — other customers' responses).
    return {
      success: true as const,
      data: serialize({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        questions: survey.questions.map((q) => ({
          id: q.id,
          question: q.question,
          type: q.type,
          options: q.options,
          isRequired: q.isRequired,
          order: q.order,
        })),
      }),
    };
  } catch (error) {
    console.error("[GET_PUBLIC_SURVEY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch survey" };
  }
}
