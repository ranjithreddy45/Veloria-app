import { z } from "zod";

// ============================================================
// Send Guest Invitation Schema
// ============================================================

export const sendInvitationSchema = z.object({
  guestId: z.string().min(1, "Guest is required"),
  bookingId: z.string().min(1, "Booking is required"),
  customMessage: z
    .string()
    .max(2000, "Custom message must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type SendInvitationInput = z.infer<typeof sendInvitationSchema>;

// ============================================================
// Bulk Send Invitations Schema
// ============================================================

export const bulkSendInvitationSchema = z.object({
  guestIds: z.array(z.string().min(1)).min(1, "At least one guest is required"),
  bookingId: z.string().min(1, "Booking is required"),
  customMessage: z
    .string()
    .max(2000, "Custom message must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type BulkSendInvitationInput = z.infer<
  typeof bulkSendInvitationSchema
>;

// ============================================================
// RSVP Response Schema (public — no auth)
// ============================================================

export const rsvpResponseSchema = z.object({
  token: z.string().min(1, "Token is required"),
  response: z.enum(["ACCEPTED", "DECLINED"]),
  plusOnes: z.coerce.number().int().min(0).max(10).optional().default(0),
  dietaryRestrictions: z
    .string()
    .max(500)
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .max(1000)
    .optional()
    .or(z.literal("")),
});

export type RsvpResponseInput = z.infer<typeof rsvpResponseSchema>;

// ============================================================
// Reminder Template Schema
// ============================================================

export const upsertReminderTemplateSchema = z.object({
  bookingId: z.string().min(1, "Booking is required"),
  stage: z.enum([
    "SAVE_THE_DATE",
    "EXCITEMENT_BUILDER",
    "FINAL_COUNTDOWN",
    "TOMORROW_REMINDER",
    "DAY_OF_WELCOME",
  ]),
  subject: z.string().min(1, "Subject is required").max(200),
  messageTemplate: z
    .string()
    .min(1, "Message template is required")
    .max(4096),
});

export type UpsertReminderTemplateInput = z.infer<
  typeof upsertReminderTemplateSchema
>;
