import { z } from "zod";
import { canonicalPhone } from "@/lib/phone";

// ============================================================
// POST /api/v1/push/leads — what a pushed lead may contain, and its one
// canonical form once validated.
//
// Unknown top-level fields are dropped, not stored: a client can't write to a
// column by guessing its name. Anything an ad platform adds that we have no
// field for belongs in `metadata`, which is bounded in size and shape and kept
// as JSON on the lead's touch record, so new marketing parameters never need a
// migration.
// ============================================================

/** Source slug → the CRM's LeadSource. Unlisted slugs are accepted and stored as OTHER. */
export const PUSH_SOURCE_TO_LEAD_SOURCE: Record<string, string> = {
  website: "WEBSITE",
  google_ads: "GOOGLE_ADS",
  meta_ads: "FACEBOOK_ADS",
  facebook_ads: "FACEBOOK_ADS",
  instagram: "INSTAGRAM",
  linkedin_ads: "ADVERTISEMENT",
  whatsapp: "WHATSAPP",
  walk_in: "WALK_IN",
  phone: "PHONE_INQUIRY",
  email: "EMAIL",
  referral: "REFERRAL",
  partner: "PARTNER",
  indiamart: "INDIAMART",
  justdial: "JUSTDIAL",
  wedmegood: "WEDMEGOOD",
  event: "EVENT",
  api: "OTHER",
  // Leads CallVibe creates when a call arrives for a number we hold no lead for.
  callvibe: "PHONE_INQUIRY",
};

export function leadSourceFor(source: string): string {
  return PUSH_SOURCE_TO_LEAD_SOURCE[source] ?? "OTHER";
}

const MAX_METADATA_BYTES = 8 * 1024;
const MAX_METADATA_KEYS = 50;
const MAX_METADATA_DEPTH = 3;

/** Characters we never keep: C0 controls except tab and newline, and DEL. */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, "").trim();
}

const optionalText = (max: number) =>
  z
    .string({ message: "Must be a string" })
    .max(max, { message: `Must be at most ${max} characters` })
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return undefined;
      const t = cleanText(v);
      return t === "" ? undefined : t;
    });

/**
 * A phone number becomes "+<country><number>".
 * Indian mobiles are recognised however they're written (9876543210,
 * 919876543210, +91 98765-43210). A number without a country code that isn't
 * an Indian mobile is refused rather than guessed at — a wrong number is worse
 * than a rejected one, because nobody notices it's wrong.
 */
export function normalizePushPhone(raw: string): string | null {
  const canon = canonicalPhone(raw);
  if (!canon.startsWith("+")) return null;
  const digits = canon.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return null;
  if (digits.startsWith("91") && !/^91[6-9]\d{9}$/.test(digits)) return null;
  return canon;
}

/**
 * Whether a JSON value nests deeper than `limit`. Iterative, and it stops as
 * soon as the limit is crossed: a recursive walk let a 60 KB body of 30,000
 * nested arrays overflow the stack and turn a validation error into a 500.
 */
export function exceedsDepth(value: unknown, limit: number): boolean {
  const stack: { v: unknown; d: number }[] = [{ v: value, d: 0 }];
  while (stack.length) {
    const { v, d } = stack.pop()!;
    if (v === null || typeof v !== "object") continue;
    if (d + 1 > limit) return true;
    for (const child of Array.isArray(v) ? v : Object.values(v)) stack.push({ v: child, d: d + 1 });
  }
  return false;
}

/**
 * A real calendar day, optionally followed by a real ISO 8601 time:
 * "2026-12-20", "2026-12-20T18:30", "2026-12-20T18:30:00.000Z",
 * "2026-12-20T18:30:00+05:30". Rejects "2026-02-30", "20/12/2026",
 * "2026-12-20T99:99:99" and "2026-12-20T:".
 */
export function isValidIsoDate(v: string): boolean {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

const isoDate = z
  .string({ message: "Must be an ISO date (YYYY-MM-DD)" })
  .trim()
  .refine(isValidIsoDate, { message: "Must be a valid ISO date (YYYY-MM-DD)" })
  // Keep the calendar day AS WRITTEN. An event date is a day at the venue, not
  // an instant: "2026-12-20T23:30-05:00" is the 20th wherever it was typed.
  .transform((v) => v.slice(0, 10));

const httpUrl = z
  .string({ message: "Must be a URL" })
  .trim()
  .max(2000, { message: "Must be at most 2000 characters" })
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    },
    { message: "Must be an http(s) URL" }
  );

const hasValue = (v: string | null | undefined) => v != null && v.trim() !== "";

export const pushLeadSchema = z
  .object({
    external_id: optionalText(200),
    source: z
      .string({ message: "Required" })
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9_:.-]{0,49}$/, {
        message: "Must be a slug such as meta_ads, google_ads or website",
      }),

    name: optionalText(200),
    phone: z.string({ message: "Invalid phone number" }).max(40, { message: "Invalid phone number" }).optional().nullable(),
    email: z
      .string({ message: "Invalid email address" })
      .trim()
      .toLowerCase()
      .max(254, { message: "Invalid email address" })
      .optional()
      .nullable(),

    event_type: optionalText(100),
    event_date: isoDate.optional().nullable(),
    guest_count: z
      .number({ message: "Must be a positive whole number" })
      .int({ message: "Must be a positive whole number" })
      .positive({ message: "Must be a positive whole number" })
      .max(100_000, { message: "Must be at most 100000" })
      .optional()
      .nullable(),
    venue: optionalText(200),
    budget: z
      .number({ message: "Must be a positive number" })
      .positive({ message: "Must be a positive number" })
      .max(9_999_999_999, { message: "Must be at most 9999999999" })
      .optional()
      .nullable(),
    message: optionalText(5000),

    medium: optionalText(100),
    campaign: optionalText(200),
    campaign_id: optionalText(100),
    adset: optionalText(200),
    adset_id: optionalText(100),
    ad_id: optionalText(100),
    creative: optionalText(200),
    keyword: optionalText(200),
    utm_source: optionalText(200),
    utm_medium: optionalText(200),
    utm_campaign: optionalText(200),
    utm_term: optionalText(200),
    utm_content: optionalText(200),
    landing_page: httpUrl.optional().nullable(),
    referrer_url: httpUrl.optional().nullable(),
    gclid: optionalText(200),
    gbraid: optionalText(200),
    wbraid: optionalText(200),
    // 255, not more: the attribution store caps every label at 255, and an
    // over-long value used to make it discard the lead's whole attribution.
    fbclid: optionalText(255),

    consent: z.boolean({ message: "Must be true or false" }).optional().nullable(),

    metadata: z
      .record(z.string(), z.unknown(), { message: "Must be a JSON object" })
      .optional()
      .nullable()
      .superRefine((value, ctx) => {
        if (value == null) return;
        if (Object.keys(value).length > MAX_METADATA_KEYS) {
          ctx.addIssue({ code: "custom", message: `Must have at most ${MAX_METADATA_KEYS} keys` });
        } else if (exceedsDepth(value, MAX_METADATA_DEPTH)) {
          ctx.addIssue({ code: "custom", message: `Must be nested at most ${MAX_METADATA_DEPTH} levels deep` });
        } else if (Buffer.byteLength(JSON.stringify(value)) > MAX_METADATA_BYTES) {
          ctx.addIssue({ code: "custom", message: `Must be at most ${MAX_METADATA_BYTES} bytes` });
        }
      }),
  })
  .superRefine((v, ctx) => {
    if (hasValue(v.phone) && !normalizePushPhone(v.phone!)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Invalid phone number" });
    }
    if (hasValue(v.email) && !z.email().safeParse(v.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Invalid email address" });
    }
    if (!hasValue(v.phone) && !hasValue(v.email)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Provide a phone number or an email address, so the lead can be contacted",
      });
    }
  });

/** The validated, normalised lead the ingestion service works with. */
export interface PushLead {
  externalId?: string;
  source: string;
  leadSource: string;
  name?: string;
  phone?: string;
  email?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
  venue?: string;
  budget?: number;
  message?: string;
  consent?: boolean;
  touch: {
    medium?: string;
    campaign?: string;
    campaignId?: string;
    adset?: string;
    adsetId?: string;
    adId?: string;
    creative?: string;
    keyword?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    landingPage?: string;
    referrerUrl?: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    fbclid?: string;
  };
  metadata?: Record<string, unknown>;
}

export type ParsedPushLead = { ok: true; lead: PushLead } | { ok: false; fields: Record<string, string> };

export function parsePushLead(body: unknown): ParsedPushLead {
  const result = pushLeadSchema.safeParse(body);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.length ? issue.path.map(String).join(".") : "body";
      // The first message per field is the useful one.
      if (!(key in fields)) fields[key] = issue.message;
    }
    return { ok: false, fields };
  }
  const v = result.data;
  return {
    ok: true,
    lead: {
      externalId: v.external_id,
      source: v.source,
      leadSource: leadSourceFor(v.source),
      name: v.name,
      phone: hasValue(v.phone) ? normalizePushPhone(v.phone!) ?? undefined : undefined,
      email: hasValue(v.email) ? v.email! : undefined,
      eventType: v.event_type,
      eventDate: v.event_date ?? undefined,
      guestCount: v.guest_count ?? undefined,
      venue: v.venue,
      budget: v.budget ?? undefined,
      message: v.message,
      consent: v.consent ?? undefined,
      touch: {
        medium: v.medium,
        campaign: v.campaign,
        campaignId: v.campaign_id,
        adset: v.adset,
        adsetId: v.adset_id,
        adId: v.ad_id,
        creative: v.creative,
        keyword: v.keyword,
        utmSource: v.utm_source,
        utmMedium: v.utm_medium,
        utmCampaign: v.utm_campaign,
        utmTerm: v.utm_term,
        utmContent: v.utm_content,
        landingPage: v.landing_page ?? undefined,
        referrerUrl: v.referrer_url ?? undefined,
        gclid: v.gclid,
        gbraid: v.gbraid,
        wbraid: v.wbraid,
        fbclid: v.fbclid,
      },
      metadata: v.metadata ?? undefined,
    },
  };
}

/** Every body field the schema accepts. The OpenAPI document is tested against this so the two can't drift. */
export const PUSH_LEAD_FIELDS = Object.keys(pushLeadSchema.shape);
