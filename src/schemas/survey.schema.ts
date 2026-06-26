import { z } from "zod";

// ============================================================
// Survey Schemas
// ============================================================

export const surveyQuestionSchema = z.object({
  question: z
    .string()
    .min(1, "Question text is required")
    .max(500, "Question must be at most 500 characters"),
  type: z.enum(["RATING", "TEXT", "MULTIPLE_CHOICE", "NPS"], {
    error: "Invalid question type",
  }),
  options: z
    .array(z.string().min(1, "Option cannot be empty").max(200, "Option must be at most 200 characters"))
    .max(100, "Maximum 100 options per question")
    .optional()
    .nullable(),
  isRequired: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
});

export type SurveyQuestionInput = z.infer<typeof surveyQuestionSchema>;

export const surveySchema = z.object({
  title: z
    .string()
    .min(1, "Survey title is required")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  isActive: z.boolean().default(true),
  questions: z
    .array(surveyQuestionSchema)
    .min(1, "At least one question is required"),
});

export type SurveyInput = z.infer<typeof surveySchema>;

// ============================================================
// Survey Response Schemas
// ============================================================

export const surveyAnswerSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  value: z.string().min(1, "Answer is required"),
});

export type SurveyAnswerInput = z.infer<typeof surveyAnswerSchema>;

export const surveyResponseSchema = z.object({
  surveyId: z.string().min(1, "Survey ID is required"),
  bookingId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  overallRating: z.number().int().min(1).max(5).optional().nullable(),
  npsScore: z.number().int().min(0).max(10).optional().nullable(),
  answers: z
    .array(surveyAnswerSchema)
    .min(1, "At least one answer is required"),
});

export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;

// ============================================================
// Survey Invitation Schema
// ============================================================

export const surveyInvitationSchema = z.object({
  surveyId: z.string().min(1, "Survey ID is required"),
  email: z.string().email("Valid email is required"),
  contactName: z
    .string()
    .min(1, "Contact name is required")
    .max(200, "Name must be at most 200 characters"),
  bookingId: z.string().optional().nullable(),
});

export type SurveyInvitationInput = z.infer<typeof surveyInvitationSchema>;
