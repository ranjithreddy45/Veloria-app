import { z } from "zod";
import { validateStorefrontSlug } from "@/lib/franchise/slug";

// ============================================================
// Franchise / partner enablement schemas (no IO)
// ============================================================
// Mirrors the Prisma enums in prisma/schema.prisma:
//   FranchiseOnboardingStatus, RevenueShareBasis, RevenueSharePayoutStatus

export const franchiseStatusValues = [
  "DRAFT",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "ACTIVE",
  "SUSPENDED",
] as const;

export const revenueShareBasisValues = [
  "GROSS_REVENUE",
  "NET_REVENUE",
  "FLAT_FEE",
] as const;

export const revenueSharePayoutStatusValues = [
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

// ------------------------------------------------------------
// Partner identity
// ------------------------------------------------------------

export const franchisePartnerSchema = z.object({
  name: z
    .string()
    .min(1, "Partner name is required")
    .max(200, "Partner name must be at most 200 characters"),
  legalName: z.string().max(200).optional().nullable(),
  contactEmail: z
    .string()
    .email("Enter a valid email")
    .max(200)
    .optional()
    .nullable()
    .or(z.literal("")),
  contactPhone: z.string().max(40).optional().nullable().or(z.literal("")),
  ownerUserId: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  status: z.enum(franchiseStatusValues).default("DRAFT"),
});

export type FranchisePartnerInput = z.infer<typeof franchisePartnerSchema>;

// ------------------------------------------------------------
// Onboarding wizard step save
// ------------------------------------------------------------

export const franchiseOnboardingStepSchema = z.object({
  step: z
    .number()
    .int("Step must be a whole number")
    .min(0, "Step must be non-negative")
    .max(50, "Step out of range"),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type FranchiseOnboardingStepInput = z.infer<
  typeof franchiseOnboardingStepSchema
>;

// ------------------------------------------------------------
// Franchise venue + white-label storefront settings
// ------------------------------------------------------------

export const franchiseVenueSchema = z.object({
  partnerId: z.string().min(1, "Partner is required"),
  venueId: z.string().min(1, "Venue is required"),
  storefrontSlug: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || validateStorefrontSlug(v) === null, {
      message:
        "Slug must be 3–60 lowercase letters/numbers/dashes and not a reserved word.",
    }),
  brandName: z.string().max(120).optional().nullable(),
  logoUrl: z.string().url("Enter a valid URL").max(1000).optional().nullable().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(HEX_COLOR, "Enter a hex color like #4f46e5")
    .optional()
    .nullable()
    .or(z.literal("")),
  customDomain: z.string().max(255).optional().nullable().or(z.literal("")),
  storefrontConfig: z.record(z.string(), z.unknown()).default({}),
  isStorefrontLive: z.boolean().default(false),
});

export type FranchiseVenueInput = z.infer<typeof franchiseVenueSchema>;

// For updates the partner/venue pairing is fixed; only settings change.
export const franchiseVenueUpdateSchema = franchiseVenueSchema
  .omit({ partnerId: true, venueId: true });

export type FranchiseVenueUpdateInput = z.infer<
  typeof franchiseVenueUpdateSchema
>;

// ------------------------------------------------------------
// Revenue-share config
// ------------------------------------------------------------

export const revenueShareConfigSchema = z
  .object({
    name: z.string().min(1, "Config name is required").max(200),
    basis: z.enum(revenueShareBasisValues).default("GROSS_REVENUE"),
    sharePct: z.coerce
      .number({ error: "Share % must be a number" })
      .min(0, "Share % cannot be negative")
      .max(100, "Share % cannot exceed 100")
      .default(0),
    flatFeeAmount: z.coerce
      .number({ error: "Flat fee must be a number" })
      .min(0, "Flat fee cannot be negative")
      .optional()
      .nullable(),
    currency: z.string().min(1).max(8).default("INR"),
    isActive: z.boolean().default(true),
    effectiveFrom: z.coerce.date().optional().nullable(),
    effectiveTo: z.coerce.date().optional().nullable(),
    partnerId: z.string().min(1, "Partner is required"),
    venueId: z.string().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.basis === "FLAT_FEE") {
      if (val.flatFeeAmount == null || val.flatFeeAmount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["flatFeeAmount"],
          message: "Flat fee amount is required when basis is Flat fee",
        });
      }
    } else {
      if (val.sharePct == null || val.sharePct <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["sharePct"],
          message: "Share % must be greater than 0 for this basis",
        });
      }
    }
    if (
      val.effectiveFrom &&
      val.effectiveTo &&
      val.effectiveTo < val.effectiveFrom
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "End date must be after start date",
      });
    }
  });

export type RevenueShareConfigInput = z.infer<typeof revenueShareConfigSchema>;

// ------------------------------------------------------------
// Payout status transition action
// ------------------------------------------------------------

export const revenueSharePayoutActionSchema = z.object({
  status: z.enum(revenueSharePayoutStatusValues),
  paymentRef: z.string().max(200).optional().nullable(),
});

export type RevenueSharePayoutActionInput = z.infer<
  typeof revenueSharePayoutActionSchema
>;

export const recomputePayoutSchema = z.object({
  partnerId: z.string().min(1, "Partner is required"),
  venueId: z.string().min(1, "Venue is required"),
  period: z.string().regex(PERIOD, "Period must be YYYY-MM"),
});

export type RecomputePayoutInput = z.infer<typeof recomputePayoutSchema>;
