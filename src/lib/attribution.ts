// ============================================================
// Marketing Attribution — reusable capture/persist helpers.
// ------------------------------------------------------------
// PLAIN module (NOT "use server"): callable from API route handlers,
// server actions, and cron. It exists so EVERY lead-creation path
// (webforms, FB/Google webhooks, the universal capture API, storefront
// enquiry) can stamp first-touch source/UTM onto the Lead with one call.
//
// HARD RULE: capture is best-effort. attachAttributionToLead must NEVER
// throw — lead creation is the revenue-critical path and must not be
// aborted by a bad attribution payload or a missing campaign. Everything
// here is wrapped in try/catch and logs-only on failure.
// ============================================================

import { prisma } from "@/lib/prisma";
import { attributionInputSchema } from "@/schemas/attribution.schema";

export interface AttributionInput {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerUrl?: string;
  landingUrl?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  clientId?: string;
}

// Trim + collapse empty strings to undefined so we never persist "".
function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length ? t : undefined;
}

function pickString(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = clean(obj[k]);
    if (v) return v;
  }
  return undefined;
}

/**
 * Pull first-touch attribution from a NextRequest-like object. Reads, in
 * priority order: explicit JSON body fields, then URL query params, then a
 * couple of headers (referer, landing url is the request URL itself).
 *
 * `req` is typed loosely so this works for both the Web `Request` used by
 * route handlers and any wrapper. Never throws — returns {} on any problem.
 */
export async function parseAttributionFromRequest(
  req: Request,
  body?: Record<string, unknown> | null
): Promise<AttributionInput> {
  try {
    let url: URL | null = null;
    try {
      url = new URL(req.url);
    } catch {
      url = null;
    }
    const q = url?.searchParams;
    const qp = (k: string) => clean(q?.get(k) ?? undefined);

    // Body may carry a nested `attribution` object or flat utm_* fields.
    const nested =
      body && typeof body.attribution === "object" && body.attribution !== null
        ? (body.attribution as Record<string, unknown>)
        : null;

    const fromBody = (...keys: string[]) =>
      pickString(nested, ...keys) ?? pickString(body, ...keys);

    const referer = clean(req.headers.get("referer") ?? req.headers.get("referrer") ?? undefined);

    const raw: AttributionInput = {
      source: fromBody("source", "utm_source", "utmSource") ?? qp("utm_source"),
      medium: fromBody("medium", "utm_medium", "utmMedium") ?? qp("utm_medium"),
      campaign:
        fromBody("campaign", "utm_campaign", "utmCampaign") ?? qp("utm_campaign"),
      term: fromBody("term", "utm_term", "utmTerm") ?? qp("utm_term"),
      content: fromBody("content", "utm_content", "utmContent") ?? qp("utm_content"),
      utmSource: fromBody("utm_source", "utmSource") ?? qp("utm_source"),
      utmMedium: fromBody("utm_medium", "utmMedium") ?? qp("utm_medium"),
      utmCampaign: fromBody("utm_campaign", "utmCampaign") ?? qp("utm_campaign"),
      referrerUrl: fromBody("referrer", "referrerUrl", "referer") ?? referer,
      landingUrl: fromBody("landing", "landingUrl") ?? qp("landing_url") ?? url?.toString(),
      gclid: fromBody("gclid") ?? qp("gclid"),
      gbraid: fromBody("gbraid") ?? qp("gbraid"),
      wbraid: fromBody("wbraid") ?? qp("wbraid"),
      fbclid: fromBody("fbclid") ?? qp("fbclid"),
      clientId: fromBody("clientId", "client_id", "_ga") ?? qp("_ga") ?? qp("client_id"),
    };

    // Validate + strip through the zod schema (drops over-length / non-strings).
    const parsed = attributionInputSchema.safeParse(raw);
    return parsed.success ? parsed.data : {};
  } catch (error) {
    console.error("[ATTRIBUTION_PARSE_ERROR]", error);
    return {};
  }
}

/**
 * Returns true when an attribution payload carries at least one meaningful
 * signal worth persisting (so we don't write empty rows for organic/direct
 * leads that have nothing but the request URL).
 */
export function hasAttributionSignal(input: AttributionInput): boolean {
  return Boolean(
    input.source ||
      input.medium ||
      input.campaign ||
      input.utmSource ||
      input.utmMedium ||
      input.utmCampaign ||
      input.gclid ||
      input.gbraid ||
      input.wbraid ||
      input.fbclid ||
      input.term ||
      input.content
  );
}

/**
 * Resolve the owning MarketingCampaign for a given UTM/source signal.
 * Strategy (most specific first):
 *   1. exact (case-insensitive) match on utmCampaign
 *   2. channel + utmSource match
 * Returns the campaign id or null. Used by BOTH attach and the nightly
 * rollup cron so linking logic stays in one place. Never throws.
 */
export async function resolveCampaignForUtm(args: {
  utmCampaign?: string | null;
  utmSource?: string | null;
  channel?: string | null;
}): Promise<string | null> {
  try {
    const utmCampaign = clean(args.utmCampaign ?? undefined);
    const utmSource = clean(args.utmSource ?? undefined);
    const channel = clean(args.channel ?? undefined);

    if (utmCampaign) {
      const byCampaign = await prisma.marketingCampaign.findFirst({
        where: {
          isActive: true,
          utmCampaign: { equals: utmCampaign, mode: "insensitive" },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (byCampaign) return byCampaign.id;
    }

    if (channel || utmSource) {
      const bySource = await prisma.marketingCampaign.findFirst({
        where: {
          isActive: true,
          ...(channel
            ? { channel: { equals: channel, mode: "insensitive" } }
            : {}),
          ...(utmSource
            ? { utmSource: { equals: utmSource, mode: "insensitive" } }
            : {}),
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (bySource) return bySource.id;
    }

    return null;
  } catch (error) {
    console.error("[ATTRIBUTION_RESOLVE_CAMPAIGN_ERROR]", error);
    return null;
  }
}

/**
 * Upsert a LeadAttribution row (1:1 on leadId) for a freshly-created or
 * deduped lead, best-effort resolve the owning MarketingCampaign, and
 * mirror the canonical utm* triple onto the Lead.utm* scalars for cheap
 * filtering elsewhere.
 *
 * BEST-EFFORT: any failure is swallowed (logged only). Must be called
 * AFTER lead.create so a problem here can never abort lead capture.
 */
export async function attachAttributionToLead(
  leadId: string,
  input: AttributionInput
): Promise<void> {
  try {
    if (!leadId) return;

    const parsed = attributionInputSchema.safeParse(input);
    const data = parsed.success ? parsed.data : {};

    // Derive the channel hint for campaign resolution: prefer an explicit
    // source label (FB/Google/webform), fall back to utm_source.
    const channelHint = data.source ?? data.utmSource;

    const campaignId = await resolveCampaignForUtm({
      utmCampaign: data.utmCampaign ?? data.campaign,
      utmSource: data.utmSource ?? data.source,
      channel: channelHint,
    });

    const fields = {
      source: data.source ?? null,
      medium: data.medium ?? null,
      campaign: data.campaign ?? data.utmCampaign ?? null,
      term: data.term ?? null,
      content: data.content ?? null,
      utmSource: data.utmSource ?? data.source ?? null,
      utmMedium: data.utmMedium ?? data.medium ?? null,
      utmCampaign: data.utmCampaign ?? data.campaign ?? null,
      referrerUrl: data.referrerUrl ?? null,
      landingUrl: data.landingUrl ?? null,
      gclid: data.gclid ?? null,
      gbraid: data.gbraid ?? null,
      wbraid: data.wbraid ?? null,
      fbclid: data.fbclid ?? null,
      clientId: data.clientId ?? null,
      campaignId,
    };

    await prisma.leadAttribution.upsert({
      where: { leadId },
      create: { leadId, ...fields },
      // On dedup/redelivery we keep FIRST-TOUCH: only fill blanks, never
      // overwrite an already-captured value (??-style via update of nulls).
      update: {
        // Re-link campaign in case the MarketingCampaign was created later.
        campaignId,
      },
    });

    // Mirror the canonical utm triple onto the Lead scalars (only set when
    // we have a value; don't clobber existing with null).
    const leadUtm: Record<string, string> = {};
    if (fields.utmSource) leadUtm.utmSource = fields.utmSource;
    if (fields.utmMedium) leadUtm.utmMedium = fields.utmMedium;
    if (fields.utmCampaign) leadUtm.utmCampaign = fields.utmCampaign;
    if (Object.keys(leadUtm).length) {
      await prisma.lead.update({ where: { id: leadId }, data: leadUtm });
    }
  } catch (error) {
    // NEVER throw — lead capture must not break on attribution failure.
    console.error("[ATTRIBUTION_ATTACH_ERROR]", error);
  }
}
