import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal, getSystemUserId } from "@/lib/lead-capture";
import { attachAttributionToLead, type AttributionInput } from "@/lib/attribution";
import { logActivity } from "@/lib/activity-logger";
import { coarseContactWhere, matchesContactKey } from "@/lib/dedup";
import { emitDomainEvent } from "../events";
import type { PushLead } from "./schema";

// ============================================================
// Lead ingestion for the Push API.
//
// This file decides only what is specific to pushing: is this a lead we
// already hold (by the caller's own external id, or the same person within the
// dedup window), and what to record about the touch. Creating a lead is handed
// to captureLeadFromExternal — the function every webhook uses — so contact
// matching, assignment rules, scoring, consent, the SLA clock and the intake
// workflows behave identically whichever door a lead came through.
// ============================================================

export interface IngestContext {
  apiKeyId: string;
  requestId: string;
  dedupWindowHours: number;
}

export type MatchedBy = "external_id" | "recent_contact" | "contact_open_lead";

export interface IngestResult {
  leadId: string;
  contactId: string;
  status: string;
  created: boolean;
  duplicate: boolean;
  matchedBy: MatchedBy | null;
  updatedFields: string[];
}

/** Namespaced so a pushed id can never collide with a Facebook or Google webhook marker. */
export function captureExternalId(source: string, externalId: string): string {
  return `push:${source}:${externalId}`;
}

const CLOSED_STATUSES = ["WON", "LOST"] as const;

export async function ingestPushLead(lead: PushLead, ctx: IngestContext): Promise<IngestResult> {
  const venueId = lead.venue ? await resolveVenueId(lead.venue) : undefined;

  // 1. The caller's own id — the strongest signal there is.
  let existing: { id: string; contactId: string } | null = null;
  let matchedBy: MatchedBy | null = null;
  if (lead.externalId) {
    existing = await findByExternalRef(lead.source, lead.externalId);
    if (existing) matchedBy = "external_id";
  }

  // 2. The same person, still open, pushed again within the window.
  if (!existing) {
    existing = await findRecentOpenLead(lead, ctx.dedupWindowHours);
    if (existing) matchedBy = "recent_contact";
  }

  let leadId: string;
  let contactId: string;
  let created = false;
  let updatedFields: string[] = [];

  if (existing) {
    leadId = existing.id;
    contactId = existing.contactId;
    updatedFields = await updateExistingLead(existing.id, lead, venueId, ctx, { appendNote: true });
    await attachAttributionToLead(leadId, attributionFor(lead)); // fills blanks only; first touch is kept
  } else {
    const result = await captureLeadFromExternal({
      name: lead.name ?? fallbackName(lead),
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      leadSource: lead.leadSource,
      message: lead.message,
      eventType: lead.eventType,
      eventDate: lead.eventDate,
      guestCount: lead.guestCount,
      estimatedValue: lead.budget,
      venueId,
      attribution: attributionFor(lead),
      externalId: lead.externalId ? captureExternalId(lead.source, lead.externalId) : undefined,
      consent: lead.consent
        ? {
            given: true,
            source: "/api/v1/push/leads",
            text: `Consent asserted by the pushing system (${lead.source}) via the Push API.`,
          }
        : undefined,
      // Nobody is waiting on a push the way a person waits on a form, but the
      // pushing system is: answer once the lead is saved, and let the welcome
      // message, workflows and notifications run after the response.
      deferTail: true,
    });
    if (!result.success || !result.leadId || !result.contactId) {
      throw new Error(`captureLeadFromExternal failed: ${"error" in result ? result.error : "no lead id"}`);
    }
    leadId = result.leadId;
    contactId = result.contactId;
    if ("deduped" in result && result.deduped) {
      // Capture folded this into an open lead for the same person and event
      // (and already wrote its own re-enquiry note), or matched the external id
      // marker. Still fill any blanks it doesn't cover, such as the budget.
      matchedBy = "contact_open_lead";
      updatedFields = await updateExistingLead(leadId, lead, venueId, ctx, { appendNote: false });
    } else {
      created = true;
    }
  }

  if (lead.externalId) await ensureExternalRef(lead.source, lead.externalId, leadId, ctx.apiKeyId);
  await recordTouch(leadId, lead, ctx);

  const current = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, createdAt: true } });
  const status = current?.status ?? "NEW";

  if (created) {
    await emitDomainEvent({
      type: "lead.created",
      resourceType: "Lead",
      resourceId: leadId,
      // Identifiers and attribution only. A consumer that needs contact details
      // (e.g. hashed matching for Meta CAPI) reads them from the CRM itself.
      payload: {
        lead_id: leadId,
        contact_id: contactId,
        status,
        source: lead.source,
        lead_source: lead.leadSource,
        external_id: lead.externalId ?? null,
        campaign: lead.touch.campaign ?? lead.touch.utmCampaign ?? null,
        campaign_id: lead.touch.campaignId ?? null,
        adset_id: lead.touch.adsetId ?? null,
        ad_id: lead.touch.adId ?? null,
        gclid: lead.touch.gclid ?? null,
        fbclid: lead.touch.fbclid ?? null,
        created_at: (current?.createdAt ?? new Date()).toISOString(),
        api_key_id: ctx.apiKeyId,
        request_id: ctx.requestId,
      },
    });
  }

  return {
    leadId,
    contactId,
    status,
    created,
    duplicate: !created,
    matchedBy,
    updatedFields,
  };
}

function fallbackName(lead: PushLead): string {
  if (lead.email) return lead.email.split("@")[0]!;
  return "Unnamed enquiry";
}

async function resolveVenueId(name: string): Promise<string | undefined> {
  const venue = await prisma.venue.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" }, isActive: true },
    select: { id: true },
  });
  return venue?.id;
}

async function findByExternalRef(source: string, externalId: string) {
  const ref = await prisma.leadExternalRef.findUnique({
    where: { source_externalId: { source, externalId } },
    select: { lead: { select: { id: true, contactId: true, deletedAt: true } } },
  });
  if (!ref || ref.lead.deletedAt) return null;
  return { id: ref.lead.id, contactId: ref.lead.contactId };
}

/**
 * An open lead for the same person, created within the window.
 *
 * Matched on normalised phone or email only — never on name. A closed lead
 * (WON/LOST) is not reopened: a returning customer is a new opportunity.
 */
async function findRecentOpenLead(lead: PushLead, windowHours: number) {
  const where = coarseContactWhere(lead.email, lead.phone);
  if (!where) return null;
  const candidates = await prisma.contact.findMany({
    where: { ...where, deletedAt: null },
    select: { id: true, email: true, phone: true },
    take: 25,
  });
  const contactIds = matchesContactKey(candidates, lead.email, lead.phone).map((c) => c.id);
  if (contactIds.length === 0) return null;
  return prisma.lead.findFirst({
    where: {
      contactId: { in: contactIds },
      deletedAt: null,
      status: { notIn: [...CLOSED_STATUSES] },
      createdAt: { gte: new Date(Date.now() - windowHours * 3_600_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, contactId: true },
  });
}

/**
 * Fill what the lead is still missing — never overwrite what a rep recorded —
 * and leave an audit trail saying the Push API did it. createdAt is untouched.
 */
async function updateExistingLead(
  leadId: string,
  lead: PushLead,
  venueId: string | undefined,
  ctx: IngestContext,
  opts: { appendNote: boolean }
): Promise<string[]> {
  const row = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      description: true,
      eventType: true,
      eventDate: true,
      guestCount: true,
      estimatedValue: true,
      preferredVenueId: true,
    },
  });
  if (!row) return [];

  const data: Prisma.LeadUpdateInput = {};
  const updated: string[] = [];
  if (!row.eventType && lead.eventType) {
    data.eventType = lead.eventType;
    updated.push("event_type");
  }
  if (!row.eventDate && lead.eventDate) {
    data.eventDate = new Date(`${lead.eventDate}T00:00:00.000Z`);
    updated.push("event_date");
  }
  if (row.guestCount == null && lead.guestCount != null) {
    data.guestCount = lead.guestCount;
    updated.push("guest_count");
  }
  if (row.estimatedValue == null && lead.budget != null) {
    data.estimatedValue = lead.budget;
    updated.push("budget");
  }
  if (!row.preferredVenueId && venueId) {
    data.preferredVenue = { connect: { id: venueId } };
    updated.push("venue");
  }
  if (opts.appendNote) {
    const stamp = new Date().toISOString().slice(0, 10);
    const note = `Pushed again via Push API (${lead.source}) on ${stamp}${lead.message ? ` — ${lead.message}` : ""}`;
    data.description = [row.description, note].filter(Boolean).join("\n");
  }

  if (Object.keys(data).length > 0) {
    await prisma.lead.update({ where: { id: leadId }, data });
  }

  try {
    const systemUserId = await getSystemUserId();
    await logActivity({
      userId: systemUserId,
      action: "push_api_updated",
      entityType: "Lead",
      entityId: leadId,
      changes: {
        via: "push_api",
        source: lead.source,
        external_id: lead.externalId ?? null,
        api_key_id: ctx.apiKeyId,
        request_id: ctx.requestId,
        filled_fields: updated,
      },
    });
  } catch {
    // The audit trail is also in PushApiRequestLog; an ActivityLog failure is non-fatal.
  }
  return updated;
}

/** Link (source, externalId) to the lead. A concurrent request inserting the same pair is not an error. */
async function ensureExternalRef(source: string, externalId: string, leadId: string, apiKeyId: string) {
  try {
    await prisma.leadExternalRef.create({ data: { source, externalId, leadId, apiKeyId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    console.error(JSON.stringify({ level: "error", event: "push_api_external_ref_failed", lead_id: leadId, error: String(e) }));
  }
}

async function recordTouch(leadId: string, lead: PushLead, ctx: IngestContext) {
  const t = lead.touch;
  const metadata = {
    ...(lead.metadata ?? {}),
    ...(t.referrerUrl ? { referrer_url: t.referrerUrl } : {}),
    ...(t.gclid ? { gclid: t.gclid } : {}),
    ...(t.gbraid ? { gbraid: t.gbraid } : {}),
    ...(t.wbraid ? { wbraid: t.wbraid } : {}),
    ...(t.fbclid ? { fbclid: t.fbclid } : {}),
  };
  try {
    await prisma.leadTouch.create({
      data: {
        leadId,
        channel: "push_api",
        source: lead.source,
        medium: t.medium ?? null,
        campaign: t.campaign ?? null,
        campaignId: t.campaignId ?? null,
        adset: t.adset ?? null,
        adsetId: t.adsetId ?? null,
        adId: t.adId ?? null,
        creative: t.creative ?? null,
        keyword: t.keyword ?? null,
        utmSource: t.utmSource ?? null,
        utmMedium: t.utmMedium ?? null,
        utmCampaign: t.utmCampaign ?? null,
        utmTerm: t.utmTerm ?? null,
        utmContent: t.utmContent ?? null,
        landingPage: t.landingPage ?? null,
        metadata: Object.keys(metadata).length ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        externalId: lead.externalId ?? null,
        apiKeyId: ctx.apiKeyId,
        requestId: ctx.requestId,
      },
    });
  } catch (e) {
    // The lead exists; losing one touch row must not turn a saved lead into a 500.
    console.error(JSON.stringify({ level: "error", event: "push_api_touch_failed", lead_id: leadId, request_id: ctx.requestId, error: String(e) }));
  }
}

/** First-touch attribution in the shape the existing LeadAttribution writer expects. */
export function attributionFor(lead: PushLead): AttributionInput {
  const t = lead.touch;
  const isGoogle = lead.source === "google_ads";
  return {
    source: lead.source,
    medium: t.medium,
    campaign: t.campaign,
    term: t.keyword ?? t.utmTerm,
    content: t.utmContent ?? t.creative,
    utmSource: t.utmSource,
    utmMedium: t.utmMedium,
    utmCampaign: t.utmCampaign,
    referrerUrl: t.referrerUrl,
    landingUrl: t.landingPage,
    gclid: t.gclid,
    gbraid: t.gbraid,
    wbraid: t.wbraid,
    fbclid: t.fbclid,
    ...(isGoogle
      ? { gadsCampaignId: t.campaignId, gadsAdgroupId: t.adsetId, gadsCreativeId: t.adId, gadsKeyword: t.keyword }
      : {}),
  };
}
