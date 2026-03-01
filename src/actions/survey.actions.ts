"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  surveySchema,
  surveyResponseSchema,
  surveyInvitationSchema,
  surveyQuestionSchema,
  type SurveyInput,
  type SurveyResponseInput,
  type SurveyInvitationInput,
  type SurveyQuestionInput,
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

    // Delete existing questions and recreate
    await prisma.surveyQuestion.deleteMany({ where: { surveyId: id } });

    const survey = await prisma.survey.update({
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
// Add Question to Survey
// ============================================================

export async function addQuestion(surveyId: string, data: SurveyQuestionInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = surveyQuestionSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) {
      return { success: false as const, error: "Survey not found" };
    }

    const questionData = parsed.data;

    // Get max order in existing questions
    const maxOrder = await prisma.surveyQuestion.aggregate({
      where: { surveyId },
      _max: { order: true },
    });

    const question = await prisma.surveyQuestion.create({
      data: {
        question: questionData.question,
        type: questionData.type,
        options: questionData.options ?? undefined,
        isRequired: questionData.isRequired,
        order: questionData.order ?? ((maxOrder._max.order ?? -1) + 1),
        surveyId,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Survey",
      entityId: surveyId,
      changes: { addedQuestion: question.id },
    });

    revalidatePath(`/surveys/${surveyId}`);
    revalidatePath(`/surveys/${surveyId}/edit`);
    return { success: true as const, data: serialize(question) };
  } catch (error) {
    console.error("[ADD_QUESTION_ERROR]", error);
    return { success: false as const, error: "Failed to add question" };
  }
}

// ============================================================
// Update Question
// ============================================================

export async function updateQuestion(questionId: string, data: SurveyQuestionInput) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const parsed = surveyQuestionSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.surveyQuestion.findUnique({
      where: { id: questionId },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }

    const questionData = parsed.data;

    const question = await prisma.surveyQuestion.update({
      where: { id: questionId },
      data: {
        question: questionData.question,
        type: questionData.type,
        options: questionData.options ?? undefined,
        isRequired: questionData.isRequired,
        order: questionData.order,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Survey",
      entityId: existing.surveyId,
      changes: { updatedQuestion: questionId },
    });

    revalidatePath(`/surveys/${existing.surveyId}`);
    revalidatePath(`/surveys/${existing.surveyId}/edit`);
    return { success: true as const, data: serialize(question) };
  } catch (error) {
    console.error("[UPDATE_QUESTION_ERROR]", error);
    return { success: false as const, error: "Failed to update question" };
  }
}

// ============================================================
// Delete Question
// ============================================================

export async function deleteQuestion(questionId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "surveys:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const existing = await prisma.surveyQuestion.findUnique({
      where: { id: questionId },
    });
    if (!existing) {
      return { success: false as const, error: "Question not found" };
    }

    await prisma.surveyQuestion.delete({ where: { id: questionId } });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "Survey",
      entityId: existing.surveyId,
      changes: { deletedQuestion: questionId },
    });

    revalidatePath(`/surveys/${existing.surveyId}`);
    revalidatePath(`/surveys/${existing.surveyId}/edit`);
    return { success: true as const, data: { id: questionId } };
  } catch (error) {
    console.error("[DELETE_QUESTION_ERROR]", error);
    return { success: false as const, error: "Failed to delete question" };
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

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: responseData.surveyId,
        bookingId: responseData.bookingId || null,
        contactId: responseData.contactId || null,
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

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { orderBy: { order: "asc" } },
        responses: {
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

    const totalResponses = survey.responses.length;

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

    return { success: true as const, data: serialize(survey) };
  } catch (error) {
    console.error("[GET_PUBLIC_SURVEY_ERROR]", error);
    return { success: false as const, error: "Failed to fetch survey" };
  }
}
