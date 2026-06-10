import { z } from "zod";

export const hallOwnerStatusValues = [
  "PROSPECT",
  "CONTACT_MADE",
  "SITE_INSPECTION",
  "NEGOTIATION",
  "CONTRACT_DRAFTED",
  "SIGNED",
  "ONBOARDED",
  "RENEWAL",
  "CHURNED",
] as const;

export const commercialModelValues = [
  "REVENUE_SHARE",
  "FIXED_LEASE",
  "HYBRID",
  "MANAGEMENT_FEE",
] as const;

export const propertyTypeValues = [
  "BANQUET_HALL",
  "CONVENTION_CENTER",
  "MARRIAGE_GARDEN",
  "MIXED",
] as const;

export const ownershipStatusValues = [
  "SELF_OWNED",
  "LEASED",
  "FAMILY_PROPERTY",
] as const;

export const hallOwnerSchema = z.object({
  ownerName: z.string().min(1, "Owner name is required").max(200),
  companyName: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  whatsapp: z.string().max(20).optional().or(z.literal("")),
  gstin: z.string().max(20).optional().or(z.literal("")),
  numberOfHalls: z.number().int().positive().optional().nullable(),
  totalCapacity: z.number().int().positive().optional().nullable(),
  propertyCity: z.string().max(100).optional().or(z.literal("")),
  propertyType: z.enum(propertyTypeValues).optional().or(z.literal("")),
  ownershipStatus: z.enum(ownershipStatusValues).optional().or(z.literal("")),
  commercialModel: z.enum(commercialModelValues).optional().or(z.literal("")),
  revenueSharePercent: z.number().min(0).max(100).optional().nullable(),
  minimumMonthlyGuarantee: z.number().min(0).optional().nullable(),
  contractStatus: z.enum(hallOwnerStatusValues).default("PROSPECT"),
  bdOwnerId: z.string().optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

export type HallOwnerInput = z.infer<typeof hallOwnerSchema>;
