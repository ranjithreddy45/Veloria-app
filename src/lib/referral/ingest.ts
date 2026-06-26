import { prisma } from "@/lib/prisma";

// ============================================================
// Referral ingestion — core helper (NOT "use server")
// ------------------------------------------------------------
// Given a referral code present on an incoming lead (public portal, WhatsApp
// webhook, or generic API), resolve the active ReferralPartner, record a
// ReferralPortalSubmission, and mint a Referral row (source REFERRAL)
// attributing the referrer. Idempotent on (partnerId, leadId) so re-delivery
// of the same lead does not double-count. Best-effort: never throws.
// ============================================================

export interface ResolvedPartner {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  contactId: string | null;
  userId: string | null;
  vendorId: string | null;
}

/**
 * Resolve an ACTIVE partner by its public code. Returns null for unknown /
 * inactive codes. Case-insensitive match against the stored upper-case code.
 */
/** Map a ReferralPartnerType to the dormant-engine ReferralSource enum. */
function partnerTypeToReferralSource(
  type: string,
): "GUEST" | "PLANNER" | "VENDOR_REF" | "EMPLOYEE" {
  switch (type) {
    case "PLANNER":
      return "PLANNER";
    case "DECORATOR":
    case "VENDOR":
      return "VENDOR_REF";
    case "EMPLOYEE":
      return "EMPLOYEE";
    default:
      return "GUEST";
  }
}

export async function resolveReferralPartnerByCode(
  code: string,
): Promise<ResolvedPartner | null> {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;

  const partner = await prisma.referralPartner.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      isActive: true,
      contactId: true,
      userId: true,
      vendorId: true,
    },
  });

  if (!partner || !partner.isActive) return null;
  return partner;
}

export interface RecordIngestionInput {
  partnerId: string;
  leadId?: string | null;
  contactId?: string | null;
  prospectName: string;
  prospectPhone?: string | null;
  prospectEmail?: string | null;
  eventType?: string | null;
  eventDate?: Date | null;
  guestCount?: number | null;
  message?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}

export interface IngestionResult {
  ok: boolean;
  submissionId?: string;
  referralId?: string;
  deduped?: boolean;
  error?: string;
}

/**
 * Record a referral ingestion: ReferralPortalSubmission + a Referral row
 * attributing the partner. Idempotent on (partnerId, leadId) — if a submission
 * for this partner+lead already exists, it is returned unchanged.
 *
 * Self-referral guard: when the partner is keyed to a Contact and the prospect's
 * phone/email matches the partner's own contact, we still capture the lead but
 * mark the submission so it never accrues a payout (fraud / self-referral).
 */
export async function recordReferralIngestion(
  input: RecordIngestionInput,
): Promise<IngestionResult> {
  try {
    const partner = await prisma.referralPartner.findUnique({
      where: { id: input.partnerId },
      select: {
        id: true,
        type: true,
        contactId: true,
        userId: true,
        vendorId: true,
      },
    });
    if (!partner) return { ok: false, error: "Partner not found" };

    // Partner's own contact details (plain ref, no FK relation on the model).
    const partnerContact = partner.contactId
      ? await prisma.contact.findUnique({
          where: { id: partner.contactId },
          select: { phone: true, email: true },
        })
      : null;

    // Idempotency: one submission per (partner, lead).
    if (input.leadId) {
      const existing = await prisma.referralPortalSubmission.findFirst({
        where: { partnerId: input.partnerId, leadId: input.leadId },
        select: { id: true, referralId: true },
      });
      if (existing) {
        return {
          ok: true,
          submissionId: existing.id,
          referralId: existing.referralId ?? undefined,
          deduped: true,
        };
      }
    }

    // Self-referral detection (best-effort; never blocks capture).
    const partnerPhone = partnerContact?.phone?.trim();
    const partnerEmail = partnerContact?.email?.trim().toLowerCase();
    const prospectPhone = input.prospectPhone?.trim();
    const prospectEmail = input.prospectEmail?.trim().toLowerCase();
    const isSelfReferral =
      (!!partnerPhone && !!prospectPhone && partnerPhone === prospectPhone) ||
      (!!partnerEmail && !!prospectEmail && partnerEmail === prospectEmail);

    // Mint the Referral row. referrerContactId is required by the model; when
    // the partner has no contact link we fall back to the referred contact so
    // the row remains valid (still attributable via the submission.partnerId).
    let referralId: string | undefined;
    const referrerContactId = partner.contactId ?? input.contactId ?? null;

    if (referrerContactId && !isSelfReferral) {
      try {
        const referral = await prisma.referral.create({
          data: {
            referredName: input.prospectName,
            referredEmail: input.prospectEmail || null,
            referredPhone: input.prospectPhone || null,
            source: partnerTypeToReferralSource(partner.type),
            status: input.leadId ? "LEAD_CREATED" : "PENDING",
            convertedLeadId: input.leadId || null,
            referrerContactId,
            referrerUserId: partner.userId || null,
            referrerVendorId: partner.vendorId || null,
            notes: `Portal referral via partner ${input.partnerId}`,
          },
          select: { id: true },
        });
        referralId = referral.id;
      } catch (e) {
        // Referral minting is best-effort; submission is still the source of truth.
        console.error("[referral.ingest] referral mint failed", e);
      }
    }

    const submission = await prisma.referralPortalSubmission.create({
      data: {
        partnerId: input.partnerId,
        prospectName: input.prospectName,
        prospectPhone: input.prospectPhone || null,
        prospectEmail: input.prospectEmail || null,
        eventType: input.eventType || null,
        eventDate: input.eventDate || null,
        guestCount: input.guestCount ?? null,
        message: isSelfReferral
          ? `[self-referral — payout suppressed] ${input.message || ""}`.trim()
          : input.message || null,
        leadId: input.leadId || null,
        referralId: referralId || null,
        utmSource: input.utmSource || null,
        utmMedium: input.utmMedium || null,
        utmCampaign: input.utmCampaign || null,
      },
      select: { id: true },
    });

    return { ok: true, submissionId: submission.id, referralId };
  } catch (error) {
    console.error("[referral.ingest] recordReferralIngestion failed", error);
    return { ok: false, error: "Ingestion failed" };
  }
}
