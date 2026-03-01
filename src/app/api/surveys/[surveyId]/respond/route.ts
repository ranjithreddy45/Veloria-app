import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { surveyResponseSchema } from "@/schemas/survey.schema";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// ============================================================
// POST: Submit Survey Response (Public — No Auth Required)
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  try {
    // Rate limit: 10 survey responses per minute per IP
    const identifier = request.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = checkRateLimit(`survey-respond:${identifier}`, { maxRequests: 10, windowSeconds: 60 });
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.resetIn);
    }

    const { surveyId } = await params;

    // Validate survey exists and is active
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });

    if (!survey) {
      return NextResponse.json(
        { success: false, error: "Survey not found" },
        { status: 404 }
      );
    }

    if (!survey.isActive) {
      return NextResponse.json(
        { success: false, error: "This survey is no longer accepting responses" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    const parsed = surveyResponseSchema.safeParse({
      ...body,
      surveyId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const responseData = parsed.data;

    // Validate that all required questions have answers
    const requiredQuestionIds = survey.questions
      .filter((q) => q.isRequired)
      .map((q) => q.id);

    const answeredQuestionIds = responseData.answers.map((a) => a.questionId);

    const missingRequired = requiredQuestionIds.filter(
      (id) => !answeredQuestionIds.includes(id)
    );

    if (missingRequired.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Some required questions are not answered",
          missingQuestions: missingRequired,
        },
        { status: 400 }
      );
    }

    // Validate that all answer questionIds belong to this survey
    const validQuestionIds = survey.questions.map((q) => q.id);
    const invalidAnswers = responseData.answers.filter(
      (a) => !validQuestionIds.includes(a.questionId)
    );

    if (invalidAnswers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Some answers reference questions not in this survey",
        },
        { status: 400 }
      );
    }

    // Create the response
    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        surveyId,
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

    return NextResponse.json({
      success: true,
      data: {
        id: surveyResponse.id,
        message: "Thank you for your feedback!",
      },
    });
  } catch (error) {
    console.error("[SURVEY_RESPOND_API_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit survey response" },
      { status: 500 }
    );
  }
}
