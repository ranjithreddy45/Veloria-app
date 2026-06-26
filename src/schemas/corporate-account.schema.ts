import { z } from "zod";

// ============================================================
// Corporate Account farming — Zod schemas
// ============================================================
// Validated before every DB write (project convention). Money inputs arrive
// as plain numbers/strings from the rupee inputs and are converted to
// Prisma.Decimal at the action boundary — never floated into the DB.

export const CORPORATE_ACCOUNT_TIERS = [
  "PROSPECT",
  "ACTIVE",
  "KEY",
  "DORMANT",
  "CHURNED",
] as const;

export type CorporateAccountTierValue = (typeof CORPORATE_ACCOUNT_TIERS)[number];

// ------------------------------------------------------------
// Promote a corporate Contact into a CorporateAccount
// ------------------------------------------------------------
export const promoteSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
});
export type PromoteInput = z.infer<typeof promoteSchema>;

// ------------------------------------------------------------
// Owner / tier / notes update
// ------------------------------------------------------------
export const corporateAccountUpdateSchema = z.object({
  accountName: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(200, "Account name is too long")
    .optional(),
  tier: z.enum(CORPORATE_ACCOUNT_TIERS).optional(),
  ownerUserId: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().max(4000, "Notes are too long").nullable().optional(),
});
export type CorporateAccountUpdateInput = z.infer<typeof corporateAccountUpdateSchema>;

// ------------------------------------------------------------
// Multi-event commitment offer ("book N/year → locked per-plate pricing")
// ------------------------------------------------------------
// lockedPricePerPlate is an advisory snapshot only — it does NOT auto-mutate
// quotations. Reps apply it manually via the quotation per-plate override.
export const commitmentOfferSchema = z
  .object({
    committedEventsPerYear: z
      .number()
      .int("Must be a whole number")
      .min(0, "Cannot be negative")
      .max(365, "That seems too high"),
    lockedPricePerPlate: z
      .number()
      .positive("Price must be greater than zero")
      .max(1_000_000, "Price is too high")
      .nullable()
      .optional(),
    commitmentStart: z.string().trim().min(1).nullable().optional(),
    commitmentEnd: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (d) => {
      if (!d.commitmentStart || !d.commitmentEnd) return true;
      const start = new Date(d.commitmentStart);
      const end = new Date(d.commitmentEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
      return start.getTime() <= end.getTime();
    },
    {
      message: "Commitment start must be on or before the end date",
      path: ["commitmentEnd"],
    }
  );
export type CommitmentOfferInput = z.infer<typeof commitmentOfferSchema>;

// ------------------------------------------------------------
// Worklist query params
// ------------------------------------------------------------
export const corporateAccountQuerySchema = z.object({
  tier: z.enum(CORPORATE_ACCOUNT_TIERS).optional(),
  ownerUserId: z.string().trim().min(1).optional(),
  dueOnly: z.boolean().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});
export type CorporateAccountQueryInput = z.infer<typeof corporateAccountQuerySchema>;
