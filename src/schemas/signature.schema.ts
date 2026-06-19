import { z } from "zod";

// ============================================================
// E-Signature Schemas
// ============================================================

// ------------------------------------------------------------
// Create a signature request (INTERNAL)
// ------------------------------------------------------------
export const createSignatureRequestSchema = z.object({
  bookingId: z.string().min(1, { error: "Booking is required" }),
  signerName: z.string().trim().min(1).max(120).optional(),
  signerEmail: z.string().trim().email().max(160).optional().or(z.literal("")),
  signerPhone: z.string().trim().max(40).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional().default(14),
});

export type CreateSignatureRequestInput = z.infer<
  typeof createSignatureRequestSchema
>;

// ------------------------------------------------------------
// Submit a signature (PUBLIC — token scoped)
// ------------------------------------------------------------
export const signatureTypeValues = ["TYPED", "DRAWN"] as const;

export const submitSignatureSchema = z.object({
  token: z.string().min(1),
  signerName: z.string().trim().min(2, { error: "Please enter your full name" }).max(120),
  signatureType: z.enum(signatureTypeValues),
  // For TYPED: the typed name string. For DRAWN: a base64 data-URL PNG.
  signatureData: z.string().min(1, { error: "A signature is required" }),
  agreed: z.literal(true, { error: "You must agree to the Terms & Conditions" }),
});

export type SubmitSignatureInput = z.infer<typeof submitSignatureSchema>;

// ------------------------------------------------------------
// Decline a signature (PUBLIC — token scoped)
// ------------------------------------------------------------
export const declineSignatureSchema = z.object({
  token: z.string().min(1),
  reason: z.string().trim().max(1000).optional(),
});

export type DeclineSignatureInput = z.infer<typeof declineSignatureSchema>;
