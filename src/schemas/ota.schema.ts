import { z } from "zod";

// ============================================================
// OTA Syndication — Zod schemas
// ============================================================
// NOTE: This is a plain (non-"use server") module so it may export
// schemas + inferred types. Action files import these for validation.

// Mirror the Prisma OtaChannelType / OtaFeedFormat enums (schema.prisma).
export const otaChannelTypeValues = [
  "WEDMEGOOD",
  "JUSTDIAL",
  "GOOGLE_BUSINESS",
  "INDIAMART",
  "GENERIC",
] as const;

export const otaFeedFormatValues = ["JSON", "ICAL"] as const;

// LeadSource enum values reused for OtaChannel.defaultSource. Kept in sync
// with prisma `enum LeadSource`; only the values relevant to aggregators are
// surfaced first but ALL are accepted so config doesn't break if extended.
export const leadSourceValues = [
  "WEBSITE",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "WALK_IN",
  "PHONE_INQUIRY",
  "EMAIL",
  "EVENT",
  "PARTNER",
  "ADVERTISEMENT",
  "FACEBOOK_ADS",
  "GOOGLE_ADS",
  "INDIAMART",
  "JUSTDIAL",
  "WEDMEGOOD",
  "INSTAGRAM",
  "WHATSAPP",
  "OTHER",
] as const;

/**
 * fieldMapping maps a canonical lead field name -> a dot-path into the
 * aggregator's raw payload. e.g. { "name": "customer.full_name", "phone": "contact_number" }.
 * Authored by an admin in the config UI, stored as JSON on OtaChannel.
 */
export const otaFieldMappingSchema = z.record(z.string(), z.string());

/**
 * credentials is an opaque key/value bag. The only key with runtime meaning
 * today is `inboundSecret` (optional shared-secret for the inbound endpoint).
 */
export const otaCredentialsSchema = z.record(z.string(), z.string());

export const otaChannelSchema = z.object({
  id: z.string().optional(),
  channelType: z.enum(otaChannelTypeValues),
  name: z.string().min(1, "Name is required").max(120),
  feedFormat: z.enum(otaFeedFormatValues).default("JSON"),
  // Outbound feeds are per-venue. Empty string from a form select becomes null.
  venueId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() !== "" ? v : null)),
  defaultSource: z.enum(leadSourceValues).default("OTHER"),
  fieldMapping: otaFieldMappingSchema.default({}),
  credentials: otaCredentialsSchema.default({}),
  isActive: z.boolean().default(true),
});

export type OtaChannelInput = z.infer<typeof otaChannelSchema>;

/**
 * Inbound payloads are intentionally loose — every aggregator sends a
 * different shape. The actual field extraction happens at runtime via
 * OtaChannel.fieldMapping in mapInboundToLead(). We only enforce that the
 * body is a JSON object (not an array / scalar) and cap nesting implicitly
 * by size limits enforced in the route.
 */
export const otaInboundPayloadSchema = z.record(z.string(), z.any());

export type OtaInboundPayload = z.infer<typeof otaInboundPayloadSchema>;
