"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  publicReferralSubmissionSchema,
  referralCodeParamSchema,
} from "@/schemas/referral-portal.schema";
import { capturePortalReferral } from "@/lib/referral-portal/capture-portal-referral";

// ============================================================
// Referral Portal — PUBLIC (no-auth) actions for /refer/<code>
// ------------------------------------------------------------
// Access is controlled ONLY by the unguessable partner code (mirrors
// getPublicInvoiceForPayment / getReviewRequestByToken). These actions NEVER
// return internal data — no ids, email, phone, payout config, or submission
// history. The landing page sees only a minimal, non-leaking projection.
// ============================================================

const PARTNER_TYPE_LABELS: Record<string, string> = {
  PLANNER: "Event Planner",
  DECORATOR: "Decorator",
  VENDOR: "Partner Vendor",
  GUEST: "Veloria Guest",
  EMPLOYEE: "Veloria Team",
};

export interface PublicReferralPartnerView {
  found: boolean;
  /** Display name only — safe to render (e.g. "Referred by Aisha"). */
  referrerDisplayName: string;
  typeLabel: string;
  venueName: string;
  isActive: boolean;
}

const NOT_FOUND: PublicReferralPartnerView = {
  found: false,
  referrerDisplayName: "",
  typeLabel: "",
  venueName: "Veloria Grand",
  isActive: false,
};

// ---------------------------------------------------------------------------
// Resolve a partner by its public code — minimal projection only.
// ---------------------------------------------------------------------------
export async function getReferralPartnerByCode(
  code: string,
): Promise<PublicReferralPartnerView> {
  try {
    const parsed = referralCodeParamSchema.safeParse(code);
    if (!parsed.success) return NOT_FOUND;

    const partner = await prisma.referralPartner.findUnique({
      where: { code: parsed.data.toUpperCase() },
      select: { name: true, type: true, isActive: true },
    });

    if (!partner || !partner.isActive) return NOT_FOUND;

    // First name only — never leak the partner's full identity publicly.
    const displayName = partner.name.trim().split(/\s+/)[0] || "a friend";

    return {
      found: true,
      referrerDisplayName: displayName,
      typeLabel: PARTNER_TYPE_LABELS[partner.type] ?? "Partner",
      venueName: "Veloria Grand",
      isActive: true,
    };
  } catch (error) {
    console.error("[GET_REFERRAL_PARTNER_BY_CODE_ERROR]", error);
    return NOT_FOUND;
  }
}

// ---------------------------------------------------------------------------
// Submit a public referral. Rate-limited per code + per IP, honeypot-guarded,
// fully validated before any DB write. Captures the prospect as a REFERRAL
// lead and links it back to the partner. Returns only {success} — no ids.
// ---------------------------------------------------------------------------
export async function submitPublicReferral(
  code: string,
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsedCode = referralCodeParamSchema.safeParse(code);
    if (!parsedCode.success) {
      return { success: false, error: "This referral link is not valid." };
    }
    const normalizedCode = parsedCode.data.toUpperCase();

    // Rate limit: per code AND per IP to blunt enumeration / lead-spam floods.
    const ip = await getClientIp();
    const codeLimit = checkRateLimit(`refer-submit:code:${normalizedCode}`, {
      maxRequests: 10,
      windowSeconds: 60 * 10,
    });
    const ipLimit = checkRateLimit(`refer-submit:ip:${ip}`, {
      maxRequests: 8,
      windowSeconds: 60 * 10,
    });
    if (!codeLimit.success || !ipLimit.success) {
      return {
        success: false,
        error: "Too many submissions. Please try again in a little while.",
      };
    }

    const parsed = publicReferralSubmissionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please check the details and try again.",
      };
    }
    const data = parsed.data;

    // Honeypot: silently succeed so bots can't probe, but write nothing.
    if (data.website && data.website.length > 0) {
      return { success: true };
    }

    // Resolve + reject inactive/revoked codes BEFORE any lead capture.
    const partner = await prisma.referralPartner.findUnique({
      where: { code: normalizedCode },
      select: { id: true, isActive: true },
    });
    if (!partner || !partner.isActive) {
      return { success: false, error: "This referral link is no longer active." };
    }

    // Need at least one contact channel to be actionable.
    if (!data.prospectPhone && !data.prospectEmail) {
      return {
        success: false,
        error: "Please provide a phone number or email so our team can reach out.",
      };
    }

    const result = await capturePortalReferral({
      partnerId: partner.id,
      partnerCode: normalizedCode,
      prospectName: data.prospectName,
      prospectPhone: data.prospectPhone || null,
      prospectEmail: data.prospectEmail || null,
      eventType: data.eventType || null,
      eventDate: data.eventDate || null,
      guestCount: data.guestCount ?? null,
      message: data.message || null,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
    });

    if (!result.success) {
      return {
        success: false,
        error: "We couldn't submit that just now. Please try again.",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("[SUBMIT_PUBLIC_REFERRAL_ERROR]", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

// Alias kept for the flywheel spec's action name; same behaviour.
export async function submitReferralPortalLead(
  code: string,
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  return submitPublicReferral(code, input);
}

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}
