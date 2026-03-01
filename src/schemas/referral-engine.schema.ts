import { z } from "zod";

export const generateReferralCodeSchema = z.object({
  contactId: z.string().optional().or(z.literal("")),
  userId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
  source: z.enum(["GUEST", "PLANNER", "VENDOR_REF", "EMPLOYEE"]).default("GUEST"),
});

export type GenerateReferralCodeInput = z.infer<typeof generateReferralCodeSchema>;

export const createReferralWithCodeSchema = z.object({
  referredName: z.string().min(1, "Name is required").max(200),
  referredEmail: z.string().email().optional().or(z.literal("")),
  referredPhone: z.string().max(20).optional().or(z.literal("")),
  source: z.enum(["GUEST", "PLANNER", "VENDOR_REF", "EMPLOYEE"]).default("GUEST"),
  referrerContactId: z.string().min(1, "Referrer contact is required"),
  referrerUserId: z.string().optional().or(z.literal("")),
  referrerVendorId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type CreateReferralWithCodeInput = z.infer<typeof createReferralWithCodeSchema>;

export const trackConversionSchema = z.object({
  referralCode: z.string().min(1, "Referral code is required"),
  bookingId: z.string().min(1, "Booking is required"),
  bookingValue: z.number().positive("Booking value must be positive"),
});

export type TrackConversionInput = z.infer<typeof trackConversionSchema>;

export const createReferralRewardRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  triggerEvent: z.enum(["BOOKING_CONFIRMED", "HIGH_VALUE_BOOKING", "REPEAT_REFERRAL"]),
  rewardType: z.enum(["POINTS", "CASH", "DISCOUNT"]),
  rewardValue: z.number().positive("Reward value must be positive"),
  minBookingValue: z.number().positive().optional().nullable(),
  bonusMultiplier: z.number().positive().optional().nullable(),
  tierLevel: z.number().int().min(1).default(1),
});

export type CreateReferralRewardRuleInput = z.infer<typeof createReferralRewardRuleSchema>;

export const updateReferralRewardRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal("")),
  triggerEvent: z.enum(["BOOKING_CONFIRMED", "HIGH_VALUE_BOOKING", "REPEAT_REFERRAL"]).optional(),
  rewardType: z.enum(["POINTS", "CASH", "DISCOUNT"]).optional(),
  rewardValue: z.number().positive().optional(),
  minBookingValue: z.number().positive().optional().nullable(),
  bonusMultiplier: z.number().positive().optional().nullable(),
  tierLevel: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateReferralRewardRuleInput = z.infer<typeof updateReferralRewardRuleSchema>;

export const createReferralAssetSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  type: z.enum(["IMAGE", "VIDEO", "FLYER", "SOCIAL_CARD"]),
  fileUrl: z.string().url("Valid URL is required"),
});

export type CreateReferralAssetInput = z.infer<typeof createReferralAssetSchema>;
