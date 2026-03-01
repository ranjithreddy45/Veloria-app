import { z } from "zod";

// ============================================================
// Payout Type & Status Enum Values (matching Prisma enums)
// ============================================================

const payoutTypeValues = [
  "VENDOR_PAYMENT",
  "OWNER_PAYOUT",
  "COMMISSION",
] as const;

const payoutStatusValues = [
  "PENDING",
  "APPROVED",
  "PAID",
  "CANCELLED",
] as const;

// ============================================================
// Create Payout Schema
// ============================================================

export const createPayoutSchema = z.object({
  amount: z
    .number({ error: "Amount must be a number" })
    .positive("Amount must be positive"),
  type: z.enum(payoutTypeValues, {
    error: "Payout type is required",
  }),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .optional()
    .or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
  bookingId: z.string().optional().or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;

// ============================================================
// Approve Payout Schema
// ============================================================

export const approvePayoutSchema = z.object({
  id: z.string().min(1, "Payout ID is required"),
});

export type ApprovePayoutInput = z.infer<typeof approvePayoutSchema>;

export { payoutTypeValues, payoutStatusValues };
