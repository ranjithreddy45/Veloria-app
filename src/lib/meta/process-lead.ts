// ============================================================
// One Meta lead, from leadgen_id to a row the sales team can work.
// ------------------------------------------------------------
// Everything funnels through captureLeadFromExternal, the same door the website
// and Google Ads leads use, so contact de-duplication, assignment, scoring and
// the first-response clock behave identically no matter where a lead came from.
// What this file adds is the Meta-specific part: fetching the answers, mapping
// questions whose keys change whenever marketing edits them, and keeping the
// raw payload so a form change is recoverable rather than a silent data loss.
// ============================================================

import { captureLeadFromExternal } from "@/lib/lead-capture";
import { prisma } from "@/lib/prisma";

import {
  describeMetaLead,
  mapMetaLead,
  UNASSIGNED_VENUE,
  type MetaLeadPayload,
} from "./field-map";
import { fetchFormName, fetchLead, getMetaCredentials, type MetaCredentials } from "./graph";

export type ProcessOutcome =
  | { status: "captured"; leadId: string; metaLeadId: string; isTest: boolean; pipeline: string }
  | { status: "duplicate"; metaLeadId: string; leadId: string | null }
  | { status: "skipped"; metaLeadId: string; reason: string };

/** Match "Bellandur" from the ad set to a real venue, when one exists. */
async function findVenueId(label: string): Promise<string | null> {
  if (!label || label === UNASSIGNED_VENUE) return null;
  const venue = await prisma.venue.findFirst({
    where: { isActive: true, name: { contains: label, mode: "insensitive" } },
    select: { id: true },
  });
  return venue?.id ?? null;
}

/**
 * Process a payload we already have (backfill), or fetch it first (webhook).
 *
 * Idempotent on MetaLeadCapture.metaLeadId: the webhook and the backfill both
 * deliver the same lead routinely, and Meta itself retries. A second pass
 * returns "duplicate" without touching the lead.
 */
export async function processMetaLeadPayload(
  payload: MetaLeadPayload,
  creds: MetaCredentials
): Promise<ProcessOutcome> {
  const metaLeadId = String(payload.id ?? "").trim();
  if (!metaLeadId) return { status: "skipped", metaLeadId: "", reason: "No lead id in the payload" };

  const existing = await prisma.metaLeadCapture.findUnique({
    where: { metaLeadId },
    select: { leadId: true },
  });
  if (existing) return { status: "duplicate", metaLeadId, leadId: existing.leadId };

  const formId = String(payload.form_id ?? "");
  const formName = formId ? await fetchFormName(formId, creds) : null;
  const mapped = mapMetaLead(payload, formName);

  if (!mapped.phone && !mapped.email) {
    // A lead with no way to reach anyone is not a lead. It is usually a test
    // ping or a token problem, and creating it would only pollute the queue.
    await recordCapture(metaLeadId, null, payload, formName, mapped, "no contact details");
    return { status: "skipped", metaLeadId, reason: "No phone or email in the answers" };
  }

  const venueId = await findVenueId(mapped.venueLabel);
  const isOwnerLead = mapped.pipeline === "owner_partnership";

  const capture = await captureLeadFromExternal({
    name: mapped.name || "Facebook Lead",
    email: mapped.email ?? undefined,
    phone: mapped.phone ?? undefined,
    // A band like "50 - 100" becomes its lower bound; the band itself survives
    // in the note, because "50 - 100" and "50" are not the same promise.
    guestCount: mapped.guestCount ?? undefined,
    eventType: mapped.eventType ?? undefined,
    eventDate: mapped.eventDate ? mapped.eventDate.toISOString() : undefined,
    venueId: venueId ?? undefined,
    source: isOwnerLead ? "partner" : mapped.source === "Instagram Lead Ad" ? "instagram" : "facebook_ads",
    // Markers go in the note at creation: Lead has no tag column, and the note
    // is what the list search reads.
    message: [
      mapped.isTest ? "[META TEST]" : null,
      isOwnerLead ? "[OWNER PARTNERSHIP]" : null,
      mapped.source,
      describeMetaLead(mapped, payload),
    ]
      .filter(Boolean)
      .join(" · "),
    // Same key the older Facebook webhook used, so a lead captured by either
    // route is recognised as the same lead rather than duplicated.
    externalId: `fb:${metaLeadId}`,
    customFields: {
      metaLeadId,
      formId,
      formName,
      budget: mapped.budget,
      requirement: mapped.requirement,
      visitTiming: mapped.visitTiming,
      guestsBand: mapped.guestsText,
      eventDateText: mapped.eventDateText,
      venueLabel: mapped.venueLabel,
    },
    attribution: {
      source: mapped.platform === "ig" ? "instagram" : "facebook",
      medium: "paid_social",
      campaign: payload.campaign_name ?? undefined,
    },
  });

  const leadId = (capture as { leadId?: string } | null)?.leadId ?? null;

  // Neither a venue owner nor a test lead belongs in a rep's queue. They are
  // unassigned rather than given a separate capture path, so the contact
  // de-duplication above still applies to them. Which one it is stays readable
  // on MetaLeadCapture.pipeline and in the note.
  if (leadId && (isOwnerLead || mapped.isTest)) {
    await prisma.lead
      .update({ where: { id: leadId }, data: { assignedToId: null } })
      .catch((e) => console.error("[MetaLeads] could not unassign", leadId, e));
  }

  await recordCapture(metaLeadId, leadId, payload, formName, mapped, null);

  return {
    status: "captured",
    leadId: leadId ?? "",
    metaLeadId,
    isTest: mapped.isTest,
    pipeline: mapped.pipeline,
  };
}

async function recordCapture(
  metaLeadId: string,
  leadId: string | null,
  payload: MetaLeadPayload,
  formName: string | null,
  mapped: ReturnType<typeof mapMetaLead>,
  skippedReason: string | null
): Promise<void> {
  await prisma.metaLeadCapture
    .create({
      data: {
        metaLeadId,
        leadId,
        formId: payload.form_id ?? null,
        formName,
        campaignId: payload.campaign_id ?? null,
        campaignName: payload.campaign_name ?? null,
        adsetId: payload.adset_id ?? null,
        adsetName: payload.adset_name ?? null,
        adId: payload.ad_id ?? null,
        adName: payload.ad_name ?? null,
        platform: mapped.platform,
        venueLabel: mapped.venueLabel,
        pipeline: mapped.pipeline,
        isTest: mapped.isTest,
        isOrganic: Boolean(payload.is_organic),
        metaCreatedAt: payload.created_time ? new Date(payload.created_time) : null,
        rawFieldData: (payload.field_data ?? []) as never,
        processedAt: new Date(),
      },
    })
    .catch((e) => {
      // A unique-violation here means two workers raced on the same lead; the
      // lead itself is already safe, so this is not worth failing the job for.
      if (!String(e?.code).includes("P2002")) {
        console.error("[MetaLeads] could not record the capture", metaLeadId, e, skippedReason);
      }
    });
}

/** Fetch one lead from Meta and process it. */
export async function processMetaLeadById(
  leadgenId: string,
  creds?: MetaCredentials
): Promise<ProcessOutcome> {
  const credentials = creds ?? (await getMetaCredentials());
  const payload = (await fetchLead(leadgenId, credentials)) as MetaLeadPayload;
  return processMetaLeadPayload({ ...payload, id: payload.id ?? leadgenId }, credentials);
}
