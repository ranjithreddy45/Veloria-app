import { z } from "zod";

// ============================================================
// Referral Portal — Zod schemas (NOT "use server")
// ------------------------------------------------------------
// All PUBLIC input is parsed through these before any DB write. Types live
// here (not in the "use server" action files, which may only export async
// functions).
// ============================================================

export const REFERRAL_PARTNER_TYPES = [
  "PLANNER",
  "DECORATOR",
  "VENDOR",
  "GUEST",
  "EMPLOYEE",
] as const;

export const REFERRAL_PAYOUT_TYPES = ["FLAT", "PERCENT", "POINTS"] as const;

// --- Internal: create a referral partner ------------------------------------
export const createReferralPartnerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    type: z.enum(REFERRAL_PARTNER_TYPES).default("PLANNER"),
    email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    payoutType: z.enum(REFERRAL_PAYOUT_TYPES).default("FLAT"),
    payoutValue: z.coerce.number().min(0).max(100_000_000).default(0),
    payoutPercent: z.coerce.number().min(0).max(100).default(0),
    // Optional identity links (plain refs)
    contactId: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
    vendorId: z.string().trim().min(1).optional(),
    issuedFromReviewId: z.string().trim().min(1).optional(),
  })
  .refine(
    (d) => d.payoutType !== "PERCENT" || d.payoutPercent > 0,
    { message: "Percent payout requires a payout percent > 0", path: ["payoutPercent"] },
  )
  .refine(
    (d) => d.payoutType === "PERCENT" || d.payoutValue >= 0,
    { message: "Payout value is required", path: ["payoutValue"] },
  );

export type CreateReferralPartnerInput = z.infer<typeof createReferralPartnerSchema>;

// --- Internal: update a referral partner ------------------------------------
export const updateReferralPartnerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: z.enum(REFERRAL_PARTNER_TYPES).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  payoutType: z.enum(REFERRAL_PAYOUT_TYPES).optional(),
  payoutValue: z.coerce.number().min(0).max(100_000_000).optional(),
  payoutPercent: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateReferralPartnerInput = z.infer<typeof updateReferralPartnerSchema>;

// --- Public: a referral submitted through /refer/<code> ---------------------
// `website` is a honeypot — real users never see it, bots fill it.
export const publicReferralSubmissionSchema = z.object({
  prospectName: z.string().trim().min(1, "Please enter a name").max(200),
  prospectPhone: z.string().trim().max(30).optional().or(z.literal("")),
  prospectEmail: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  eventType: z.string().trim().max(100).optional().or(z.literal("")),
  eventDate: z.string().trim().max(40).optional().or(z.literal("")),
  guestCount: z.coerce.number().int().min(1).max(100_000).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot — must be empty.
  website: z.string().max(0).optional().or(z.literal("")),
  // Attribution (carried from the portal page query string)
  utmSource: z.string().trim().max(120).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(120).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(120).optional().or(z.literal("")),
});

export type PublicReferralSubmissionInput = z.infer<typeof publicReferralSubmissionSchema>;

// Code-param validation — exactly the alphabet/length the generator emits,
// so enumeration probes with malformed codes are rejected before a DB hit.
export const referralCodeParamSchema = z
  .string()
  .trim()
  .min(4)
  .max(24)
  .regex(/^[A-Z0-9]+$/i, "Invalid code");
