import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { recordReferralIngestion } from "@/lib/referral/ingest";
import type { AttributionInput } from "@/lib/attribution";

// ============================================================
// Portal referral capture orchestrator (NOT "use server")
// ------------------------------------------------------------
// Shared no-auth path used by the public submitPublicReferral action. Builds an
// ExternalLeadData (source REFERRAL), runs the proven captureLeadFromExternal
// pipeline (contact upsert, auto-assign, score, SLA clock, speed-to-lead
// WhatsApp), then links the partner → ReferralPortalSubmission → Referral via
// recordReferralIngestion and bumps the partner's submittedCount rollup.
//
// captureLeadFromExternal never throws, so each downstream best-effort step is
// independently guarded and the public caller always gets {success:true} once
// the lead is captured, even if the linkage steps degrade.
// ============================================================

export interface PortalCaptureInput {
  partnerId: string;
  partnerCode: string;
  prospectName: string;
  prospectPhone?: string | null;
  prospectEmail?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  guestCount?: number | null;
  message?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export interface PortalCaptureResult {
  success: boolean;
}

export async function capturePortalReferral(
  input: PortalCaptureInput,
): Promise<PortalCaptureResult> {
  // 1) Capture the lead via the canonical external pipeline. The partner code
  //    is carried in customFields/externalId so any future central hook can
  //    re-resolve it. externalId also de-dupes provider-style re-submits.
  const capture = await captureLeadFromExternal({
    name: input.prospectName,
    email: input.prospectEmail || undefined,
    phone: input.prospectPhone || undefined,
    source: "referral",
    message: input.message || undefined,
    eventType: input.eventType || undefined,
    eventDate: input.eventDate || undefined,
    guestCount: input.guestCount ?? undefined,
    customFields: { referralCode: input.partnerCode, partnerId: input.partnerId },
    attribution: buildAttribution(input),
  });

  if (!capture.success) {
    // Lead pipeline failed — surface failure so the form can retry.
    return { success: false };
  }

  // 2) Link partner → submission → Referral (idempotent on partner+lead).
  try {
    await recordReferralIngestion({
      partnerId: input.partnerId,
      leadId: capture.leadId ?? null,
      contactId: capture.contactId ?? null,
      prospectName: input.prospectName,
      prospectPhone: input.prospectPhone || null,
      prospectEmail: input.prospectEmail || null,
      eventType: input.eventType || null,
      eventDate: input.eventDate ? new Date(input.eventDate) : null,
      guestCount: input.guestCount ?? null,
      message: input.message || null,
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
    });
  } catch (e) {
    console.error("[capturePortalReferral] ingestion failed", e);
  }

  // 3) Bump the partner's submitted rollup authoritatively (recount).
  try {
    const submittedCount = await prisma.referralPortalSubmission.count({
      where: { partnerId: input.partnerId },
    });
    await prisma.referralPartner.update({
      where: { id: input.partnerId },
      data: { submittedCount },
    });
  } catch (e) {
    console.error("[capturePortalReferral] rollup refresh failed", e);
  }

  return { success: true };
}

function buildAttribution(input: PortalCaptureInput): AttributionInput | undefined {
  if (!input.utmSource && !input.utmMedium && !input.utmCampaign) return undefined;
  return {
    source: input.utmSource || "referral",
    medium: input.utmMedium || "partner-portal",
    campaign: input.utmCampaign || undefined,
  };
}
