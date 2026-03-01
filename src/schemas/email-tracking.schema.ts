import { z } from "zod";

// ============================================================
// Email Tracking Event Types
// ============================================================

const trackingEventTypes = ["EMAIL_OPEN", "LINK_CLICK"] as const;

// ============================================================
// Email Tracking Filter Schema
// ============================================================

export const emailTrackingFilterSchema = z.object({
  dateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  contactId: z.string().optional(),
  campaignId: z.string().optional(),
  type: z.enum(trackingEventTypes).optional(),
});

export type EmailTrackingFilterInput = z.infer<
  typeof emailTrackingFilterSchema
>;

// ============================================================
// Tracking Stats Response Types
// ============================================================

export type TrackingStats = {
  totalTracked: number;
  totalOpens: number;
  totalClicks: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
};

export type ContactEngagement = {
  contactId: string;
  contactName: string;
  contactEmail: string;
  emailsSent: number;
  opened: number;
  clicked: number;
  openRate: number;
  lastOpen: string | null;
  lastClick: string | null;
};

export type TrackingEventRow = {
  id: string;
  type: string;
  recipientEmail: string;
  subject: string | null;
  linkUrl: string | null;
  ipAddress: string | null;
  occurredAt: string;
  communicationId: string;
  contactId: string | null;
};

export type TopEngagedContact = {
  contactId: string;
  contactName: string;
  contactEmail: string;
  totalOpens: number;
  totalClicks: number;
  engagementScore: number;
  lastEngagement: string | null;
};

export type CampaignStats = {
  campaignId: string;
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
};
