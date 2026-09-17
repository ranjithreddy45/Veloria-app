import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal, getSystemUserId } from "@/lib/lead-capture";
import { attachAttributionToLead, type AttributionInput } from "@/lib/attribution";
import { logActivity } from "@/lib/activity-logger";
import { canonicalPhone } from "@/lib/phone";
import { recordConsent } from "@/lib/privacy/consent";
import { consumeDailyLeadCap } from "../rate-limit";
import type { PushLead } from "./schema";
import { identityLockKeys, withIngestLocks } from "./ingest-lock";

// ============================================================
// Lead ingestion for the Push API.
//
// This file decides whether a push is a lead we already hold, and records the
// touch. Creating a NEW lead is still handed to captureLeadFromExternal — the
// function every webhook uses — so assignment rules, scoring, the SLA clock
// and the intake workflows behave identically for every channel.
//
// What it does NOT reuse is capture's looser idea of "same enquiry". The audit
// of the first version reproduced, against a real database:
//   - 11 of 12 simultaneous pushes failing (capture's Serializable marker scan)
//   - an enquiry swallowed by a deleted lead and lost
//   - a +971 number merged into a +91 contact's lead (last-10-digit match)
//   - an external id "X" merged into the lead of "X]" (substring marker)
//   - a wedding and a corporate enquiry merged; a 10-day-old lead reused
//   - 5 simultaneous pushes for one person making 3 leads
// So the rules live here, explicitly, and capture is told not to second-guess
// them (no external-id marker, no open-lead fold):
//
//   1. same integration + source + external_id  → that lead (never a deleted one)
//   2. same email, or same phone INCLUDING country code, on an OPEN lead
//      created within the dedup window whose event type and date don't conflict
//   3. otherwise a new lead, created atomically with its external-id link,
//      touch record and lead.created event
//
// All of it runs under a lock on the push's identities, so concurrent pushes
// about the same person are decided one at a time.
// ============================================================

export interface IngestContext {
  apiKeyId: string;
  lineageId: string;
  scopes: string[];
  requestId: string;
  dedupWindowHours: number;
  maxNewLeadsPerDay: number;
}

export type MatchedBy = "external_id" | "recent_contact";

export interface IngestResult {
  leadId: string;
  contactId: string;
  status: string;
  created: boolean;
  duplicate: boolean;
  matchedBy: MatchedBy | null;
  updatedFields: string[];
}

const CLOSED_STATUSES = ["WON", "LOST"] as const;
/** Notes stop being appended once the description reaches this size. */
const MAX_DESCRIPTION_CHARS = 20_000;

/**
 * The source name capture and the assignment rules see. Assignment rules match
 * the raw source string, and every existing rule and webhook says
 * "facebook_ads" — so a Meta push must too, or it silently misses those rules.
 */
const CAPTURE_SOURCE_ALIAS: Record<string, string> = { meta_ads: "facebook_ads" };

export async function ingestPushLead(lead: PushLead, ctx: IngestContext): Promise<IngestResult> {
  const keys = identityLockKeys({
    lineageId: ctx.lineageId,
    source: lead.source,
    externalId: lead.externalId,
    phone: lead.phone,
    email: lead.email,
  });
  return withIngestLocks(keys, () => ingestLocked(lead, ctx));
}

async function ingestLocked(lead: PushLead, ctx: IngestContext): Promise<IngestResult> {
  const [venueId, byRef] = await Promise.all([
    lead.venue ? resolveVenueId(lead.venue) : Promise.resolve(undefined),
    lead.externalId ? findByExternalRef(ctx.lineageId, lead.source, lead.externalId) : Promise.resolve(null),
  ]);

  let match: { id: string; contactId: string } | null = byRef;
  let matchedBy: MatchedBy | null = byRef ? "external_id" : null;
  if (!match) {
    match = await findRecentOpenLead(lead, ctx.dedupWindowHours);
    if (match) matchedBy = "recent_contact";
  }

  if (match) {
    const canUpdate = ctx.scopes.includes("leads:update");
    const updatedFields = canUpdate ? await updateExistingLead(match, lead, venueId, ctx) : [];
    if (lead.externalId) await linkExternalId(prisma, ctx, lead, match.id);
    const status = (await prisma.lead.findUnique({ where: { id: match.id }, select: { status: true } }))?.status ?? "NEW";
    return {
      leadId: match.id,
      contactId: match.contactId,
      status,
      created: false,
      duplicate: true,
      matchedBy,
      updatedFields,
    };
  }

  // A brand-new lead. Count it against the key's daily cap first.
  await consumeDailyLeadCap(ctx.lineageId, ctx.maxNewLeadsPerDay);

  let createdRow: { id: string; contactId: string; status: string; createdAt: Date } | null = null;
  const result = await captureLeadFromExternal({
    name: lead.name ?? fallbackName(lead),
    phone: lead.phone,
    email: lead.email,
    source: CAPTURE_SOURCE_ALIAS[lead.source] ?? lead.source,
    leadSource: lead.leadSource,
    message: lead.message,
    eventType: lead.eventType,
    eventDate: lead.eventDate,
    guestCount: lead.guestCount,
    estimatedValue: lead.budget,
    venueId,
    attribution: attributionFor(lead),
    consent: lead.consent
      ? {
          given: true,
          source: "/api/v1/push/leads",
          text: `Consent asserted by the pushing system (${lead.source}, key ${ctx.apiKeyId}) via the Push API.`,
          ip: null,
          userAgent: null,
        }
      : undefined,
    // The Push API has already decided this is a new lead under stricter rules.
    skipOpenLeadFold: true,
    // Nobody authorised a WhatsApp message unless consent says so.
    suppressAutoWelcome: lead.consent !== true,
    // Answer once the lead is saved; welcome, workflows and notifications run after.
    deferTail: true,
    // The external-id link, the touch and lead.created commit WITH the lead or
    // not at all — so a lead can never exist without them, and the event can
    // never be lost to a failure after the lead was saved.
    inLeadTransaction: async (tx, row) => {
      createdRow = row;
      if (lead.externalId) await linkExternalId(tx, ctx, lead, row.id, { throwOnConflict: true });
      await tx.leadTouch.create({ data: touchData(row.id, lead, ctx) });
      await tx.integrationEvent.create({
        data: {
          type: "lead.created",
          dedupeKey: `lead.created:${row.id}`,
          resourceType: "Lead",
          resourceId: row.id,
          payload: eventPayload(row, lead, ctx) as Prisma.InputJsonValue,
        },
      });
    },
  });

  if (!result.success || !result.leadId || !result.contactId || !createdRow) {
    throw new Error(`push ingest: lead was not created (${"error" in result ? result.error : "no lead id"})`);
  }
  const row = createdRow as { id: string; contactId: string; status: string; createdAt: Date };
  // Save first-touch attribution BEFORE answering. Capture writes it in its
  // deferred tail, which could still be running when the 201 went out — so an
  // integrator (or a lead.created consumer) reading the lead straight away saw
  // none. Filling blanks is idempotent, so the tail's own write is a no-op.
  await attachAttributionToLead(row.id, attributionFor(lead));
  return {
    leadId: row.id,
    contactId: row.contactId,
    status: row.status,
    created: true,
    duplicate: false,
    matchedBy: null,
    updatedFields: [],
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

/** The lead this integration already linked to (source, externalId) — never a deleted one. */
async function findByExternalRef(lineageId: string, source: string, externalId: string) {
  const ref = await prisma.leadExternalRef.findUnique({
    where: { lineageId_source_externalId: { lineageId, source, externalId } },
    select: { id: true, lead: { select: { id: true, contactId: true, deletedAt: true } } },
  });
  if (!ref) return null;
  if (ref.lead.deletedAt) {
    // The lead it pointed at was deleted. Drop the stale link so this push
    // becomes a new lead instead of disappearing into a deleted one.
    await prisma.leadExternalRef.delete({ where: { id: ref.id } }).catch(() => {});
    return null;
  }
  return { id: ref.lead.id, contactId: ref.lead.contactId };
}

/** Same phone INCLUDING country code. Stored numbers vary in format, so both sides are canonicalised. */
export function samePhone(stored: string | null | undefined, incomingCanonical: string | undefined): boolean {
  if (!stored || !incomingCanonical) return false;
  const canon = canonicalPhone(stored);
  return canon.startsWith("+") ? canon === incomingCanonical : false;
}

/** Event details conflict only when both sides state them and they differ. A blank never conflicts. */
export function eventsCompatible(
  incoming: { eventType?: string; eventDate?: string },
  existing: { eventType: string | null; eventDate: Date | null }
): boolean {
  if (incoming.eventType && existing.eventType && incoming.eventType.trim().toLowerCase() !== existing.eventType.trim().toLowerCase()) {
    return false;
  }
  if (incoming.eventDate && existing.eventDate && incoming.eventDate !== existing.eventDate.toISOString().slice(0, 10)) {
    return false;
  }
  return true;
}

/**
 * An open lead for the same person, created within the window, for a
 * compatible event. Matched on email or full phone only — never on name, never
 * across countries, never a won/lost/deleted lead.
 */
async function findRecentOpenLead(lead: PushLead, windowHours: number) {
  const last10 = lead.phone ? lead.phone.replace(/\D/g, "").slice(-10) : null;
  // Exact comparisons in SQL, with no row cap: the old "phone contains the last
  // 4 digits, take 25" pre-filter could drop the real contact from the set.
  const candidates = await prisma.$queryRaw<{ id: string; phone: string | null; email: string | null }[]>`
    SELECT "id", "phone", "email" FROM "Contact"
    WHERE "deletedAt" IS NULL
      AND (
        (${lead.email ?? null}::text IS NOT NULL AND lower("email") = ${lead.email ?? null}::text)
        OR (${last10}::text IS NOT NULL AND right(regexp_replace(coalesce("phone", ''), '\\D', '', 'g'), 10) = ${last10}::text)
      )`;
  const contactIds = candidates
    .filter((c) => (lead.email && c.email?.toLowerCase() === lead.email) || samePhone(c.phone, lead.phone))
    .map((c) => c.id);
  if (contactIds.length === 0) return null;

  const openLeads = await prisma.lead.findMany({
    where: {
      contactId: { in: contactIds },
      deletedAt: null,
      status: { notIn: [...CLOSED_STATUSES] },
      createdAt: { gte: new Date(Date.now() - windowHours * 3_600_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, contactId: true, eventType: true, eventDate: true },
    take: 20,
  });
  const hit = openLeads.find((l) => eventsCompatible(lead, l));
  return hit ? { id: hit.id, contactId: hit.contactId } : null;
}

/**
 * Fill what the lead and its contact are still missing — never overwrite what
 * a rep recorded — append the message once, record consent once, record the
 * touch, and leave an audit trail. createdAt is untouched. One transaction.
 */
async function updateExistingLead(
  match: { id: string; contactId: string },
  lead: PushLead,
  venueId: string | undefined,
  ctx: IngestContext
): Promise<string[]> {
  const updated: string[] = [];

  await prisma.$transaction(async (tx) => {
    const row = await tx.lead.findUnique({
      where: { id: match.id },
      select: { eventType: true, eventDate: true, guestCount: true, estimatedValue: true, preferredVenueId: true },
    });
    if (!row) return;

    const data: Prisma.LeadUpdateInput = {};
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
    if (Object.keys(data).length) await tx.lead.update({ where: { id: match.id }, data });

    // The contact's own missing details: an email that arrived by phone lead, or vice versa.
    const contact = await tx.contact.findUnique({ where: { id: match.contactId }, select: { email: true, phone: true } });
    if (contact) {
      const contactData: Prisma.ContactUpdateInput = {};
      if (!contact.email && lead.email) {
        contactData.email = lead.email;
        updated.push("email");
      }
      if (!contact.phone && lead.phone) {
        contactData.phone = lead.phone;
        updated.push("phone");
      }
      if (Object.keys(contactData).length) await tx.contact.update({ where: { id: match.contactId }, data: contactData });
    }

    // The message, once. A retry or a re-send of the same text isn't a new note,
    // and the description stops growing at a sane size. Done as one atomic
    // UPDATE, so a concurrent edit can't be overwritten by a stale read.
    if (lead.message) {
      const stamp = new Date().toISOString().slice(0, 10);
      const note = `Pushed again via Push API (${lead.source}) on ${stamp} — ${lead.message}`;
      await tx.$executeRaw`
        UPDATE "Lead"
        SET "description" = CASE
          WHEN "description" IS NULL THEN ${note}
          ELSE "description" || E'\n' || ${note}
        END
        WHERE "id" = ${match.id}
          AND position(${`— ${lead.message}`} in coalesce("description", '')) = 0
          AND length(coalesce("description", '')) + length(${note}) < ${MAX_DESCRIPTION_CHARS}`;
    }

    await tx.leadTouch.create({ data: touchData(match.id, lead, ctx) });
  });

  // Consent given on a repeat push is still consent, and must be on record.
  if (lead.consent) {
    const already = await prisma.consentRecord.count({
      where: { subjectType: "CONTACT", subjectId: match.contactId, purpose: "ENQUIRY_RESPONSE" },
    });
    if (already === 0) {
      await recordConsent({
        subjectType: "CONTACT",
        subjectId: match.contactId,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        purpose: "ENQUIRY_RESPONSE",
        source: "/api/v1/push/leads",
        consentText: `Consent asserted by the pushing system (${lead.source}, key ${ctx.apiKeyId}) via the Push API.`,
        ip: null,
        userAgent: null,
      });
      updated.push("consent");
    }
  }

  // First touch is kept: this only fills attribution fields that are still empty.
  await attachAttributionToLead(match.id, attributionFor(lead));

  try {
    await logActivity({
      userId: await getSystemUserId(),
      action: "push_api_updated",
      entityType: "Lead",
      entityId: match.id,
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

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Link (integration, source, externalId) to a lead. Inside the create
 * transaction a conflict must abort the lead (someone else owns that id); on
 * an existing lead a conflict just means the link is already there.
 */
async function linkExternalId(
  db: Db,
  ctx: IngestContext,
  lead: PushLead,
  leadId: string,
  opts: { throwOnConflict?: boolean } = {}
): Promise<void> {
  try {
    await db.leadExternalRef.create({
      data: { lineageId: ctx.lineageId, source: lead.source, externalId: lead.externalId!, leadId, apiKeyId: ctx.apiKeyId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && !opts.throwOnConflict) return;
    throw e;
  }
}

function touchData(leadId: string, lead: PushLead, ctx: IngestContext): Prisma.LeadTouchUncheckedCreateInput {
  const t = lead.touch;
  const metadata = {
    ...(lead.metadata ?? {}),
    ...(t.referrerUrl ? { referrer_url: t.referrerUrl } : {}),
    ...(t.gclid ? { gclid: t.gclid } : {}),
    ...(t.gbraid ? { gbraid: t.gbraid } : {}),
    ...(t.wbraid ? { wbraid: t.wbraid } : {}),
    ...(t.fbclid ? { fbclid: t.fbclid } : {}),
  };
  return {
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
  };
}

/** Identifiers and attribution only. A consumer that needs contact details reads them from the CRM. */
function eventPayload(
  row: { id: string; contactId: string; status: string; createdAt: Date },
  lead: PushLead,
  ctx: IngestContext
): Record<string, unknown> {
  return {
    lead_id: row.id,
    contact_id: row.contactId,
    status: row.status,
    source: lead.source,
    lead_source: lead.leadSource,
    external_id: lead.externalId ?? null,
    campaign: lead.touch.campaign ?? lead.touch.utmCampaign ?? null,
    campaign_id: lead.touch.campaignId ?? null,
    adset_id: lead.touch.adsetId ?? null,
    ad_id: lead.touch.adId ?? null,
    gclid: lead.touch.gclid ?? null,
    fbclid: lead.touch.fbclid ?? null,
    created_at: row.createdAt.toISOString(),
    api_key_id: ctx.apiKeyId,
    request_id: ctx.requestId,
  };
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
