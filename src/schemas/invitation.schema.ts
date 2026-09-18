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

export const rsvpResponseSchema = z
  .object({
    token: z.string().min(1, "Token is required"),
    response: z.enum(["ACCEPTED", "DECLINED"]),
    plusOnes: z.coerce.number().int().min(0).max(10).optional().default(0),
    dietaryRestrictions: z
      .string()
      .max(500)
      .optional()
      .or(z.literal("")),
    // What the party eats, as head counts. Optional as a set — a guest may
    // accept without answering, and that party is reported as "unknown" rather
    // than guessed at. When any one is given, all three are read and they must
    // account for the whole party (see the refinement below).
    mealVeg: z.coerce.number().int().min(0).max(11).optional(),
    mealNonVeg: z.coerce.number().int().min(0).max(11).optional(),
    mealJain: z.coerce.number().int().min(0).max(11).optional(),
    // No reply note: nothing on the guest or the invitation stores one, so the RSVP
    // page doesn't offer it. A `message` from an old copy of the page is dropped here
    // (z.object strips unknown keys), not refused.
    // DPDP consent — required (checked in the action, not via .default(): a
    // default would make the field mandatory in the inferred input type).
    consent: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const given = [value.mealVeg, value.mealNonVeg, value.mealJain].filter((n) => n != null);
    if (given.length === 0) return; // answering is optional

    if (value.response !== "ACCEPTED") {
      ctx.addIssue({
        code: "custom",
        path: ["mealVeg"],
        message: "Meal numbers only apply when you're attending.",
      });
      return;
    }

    // The party is the guest plus their plus-ones. Rejecting a split that does
    // not add up is the whole point: a partial answer silently stored would be
    // read later as a real count and cooked to.
    const heads = 1 + (value.plusOnes ?? 0);
    const total = (value.mealVeg ?? 0) + (value.mealNonVeg ?? 0) + (value.mealJain ?? 0);
    if (total !== heads) {
      ctx.addIssue({
        code: "custom",
        path: ["mealVeg"],
        message: `Those add up to ${total}, but you're bringing ${heads}. Please make them match.`,
      });
    }
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
