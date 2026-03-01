import { z } from "zod";

// ============================================================
// Vendor Portal — Bid Submission Schema
// ============================================================

export const vendorPortalBidSchema = z.object({
  bookingId: z.string().min(1, "Booking is required"),
  amount: z
    .number({ error: "Bid amount must be a number" })
    .positive("Bid amount must be positive"),
  message: z
    .string()
    .max(2000, "Message must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type VendorPortalBidInput = z.infer<typeof vendorPortalBidSchema>;

// ============================================================
// Vendor Portal — Events Filter Schema
// ============================================================

const vendorAssignmentStatusValues = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
] as const;

export const vendorEventsFilterSchema = z.object({
  status: z.enum(vendorAssignmentStatusValues).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export type VendorEventsFilterInput = z.infer<typeof vendorEventsFilterSchema>;

// ============================================================
// Vendor Portal — Bids Filter Schema
// ============================================================

const vendorBidStatusValues = ["PENDING", "ACCEPTED", "REJECTED"] as const;

export const vendorBidsFilterSchema = z.object({
  status: z.enum(vendorBidStatusValues).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export type VendorBidsFilterInput = z.infer<typeof vendorBidsFilterSchema>;

// ============================================================
// Vendor Portal — Payouts Filter Schema
// ============================================================

const payoutStatusValues = ["PENDING", "APPROVED", "PAID", "CANCELLED"] as const;

export const vendorPayoutsFilterSchema = z.object({
  status: z.enum(payoutStatusValues).optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export type VendorPayoutsFilterInput = z.infer<typeof vendorPayoutsFilterSchema>;
