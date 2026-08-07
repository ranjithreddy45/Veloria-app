import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { logActivity } from "@/lib/activity-logger";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { runLeadIntake, leadSlaDeadline } from "@/lib/lead-pipeline";
import { attachAttributionToLead, type AttributionInput } from "@/lib/attribution";
import { normalizePhone } from "@/lib/sales/lead-import";
import { coarseContactWhere, matchesContactKey, phoneDigits } from "@/lib/dedup";
import { toEnquirySource, eventTypeTag, classifyWebChannel } from "@/lib/enquiry-source";

/**
 * An email is only worth storing if it could plausibly be delivered to. Same
 * reasoning as normalizePhone: a junk value ("false", "-", "N/A") looks real in
 * the CRM and costs someone a wasted follow-up, so drop it instead.
 */
function normalizeExternalEmail(raw?: string): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  // Deliberately loose — this rejects nonsense, it does not police RFC 5322.
  return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(v) ? v : undefined;
}

/**
 * One stable way to write a phone number.
 *
 * WHY THIS IS CAREFUL ABOUT COUNTRY CODES: an earlier version prepended +91 to
 * ANY bare 10-digit number. A US enquiry typed as "4155552671" — also exactly
 * ten digits — was silently stored as "+914155552671", a wrong Indian number
 * nobody can ring. Guessing a country code is worse than admitting we don't
 * know one.
 *
 * The rules, in order of confidence:
 *   1. Already E.164 ("+…") or an international prefix ("00…") → trust the code
 *      the caller gave. Google/Meta lead forms always send this shape, so every
 *      foreign AD lead lands here and is safe.
 *   2. Bare 10 digits starting 6-9 → an Indian mobile (that range is reserved
 *      for them), so +91 is a safe inference.
 *   3. Anything else → keep the digits EXACTLY as given and invent nothing.
 *
 * Residual ambiguity, stated plainly: a bare US number in the 6-9 area-code
 * range (e.g. 917…) is indistinguishable from an Indian mobile without a country
 * hint, and will still be read as Indian. Only a country selector on the form
 * can close that, which is a product change, not a parsing one.
 */
function canonicalPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  // 1. Explicit international form — trust it.
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;

  const local = digits.replace(/^0+/, "");
  // 2. Indian mobile: exactly 10 digits, first digit 6-9.
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  // 12 digits already country-coded as 91.
  if (local.length === 12 && local.startsWith("91")) return `+${local}`;
  // 3. Unknown country — store what we were given rather than guess.
  return local;
}

/** The country code of an E.164 number, or null when it carries none. */
function countryCodeOf(phone: string | null | undefined): string | null {
  const v = (phone ?? "").trim();
  if (!v.startsWith("+")) return null;
  const digits = v.replace(/\D/g, "");
  // Longest-first so +971 isn't read as +97; 1-3 digit codes cover E.164.
  for (const len of [3, 2, 1]) {
    const head = digits.slice(0, len);
    if (KNOWN_COUNTRY_CODES.has(head)) return head;
  }
  return digits.slice(0, 2); // unknown code — compare on a stable prefix
}

/** Codes we actually see. Only used to compare two numbers, never to assign one. */
const KNOWN_COUNTRY_CODES = new Set([
  "91", "1", "44", "971", "65", "61", "60", "966", "974", "968", "973", "94", "977", "880", "92", "49", "33", "39", "31", "27", "254", "255", "234", "64", "81", "82", "86", "7",
]);

interface ExternalLeadData {
  /**
   * Answer the caller as soon as the lead row is durably saved, and run the
   * enrichment tail (attribution, welcome message, intake, referral) after the
   * response has gone out.
   *
   * ONLY for paths where a human is watching a spinner — the public landing
   * form. Provider webhooks leave this off: nobody is waiting on those, and
   * completing everything inside the request is the simpler guarantee.
   *
   * Safe because the tail is entirely post-write. By the time it runs, the
   * contact and the lead already exist and are visible in the CRM; the tail
   * only decorates them. If it fails, we have an un-enriched lead, which is a
   * far better outcome than the lead never arriving.
   */
  deferTail?: boolean;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  message?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
  estimatedValue?: number; // budget — feeds scoring
  perPlateBudget?: number; // ×guestCount estimates value when no budget given
  venueId?: string; // preferred venue
  customFields?: Record<string, unknown>;
  /** First-touch marketing attribution (utm/gclid/fbclid/referrer) — best-effort. */
  attribution?: AttributionInput;
  /**
   * Provider's own lead identifier (Facebook leadgen_id / Google lead_id).
   * Used as an idempotency key so provider webhook retries do not create
   * duplicate Lead rows. Persisted into the lead description as
   * `[ext:<externalId>]` and matched on subsequent deliveries.
   */
  externalId?: string;
}

/**
 * Build the stable idempotency marker embedded in a lead's description.
 * Provider redeliveries carry the same externalId, so we can detect and
 * short-circuit duplicate captures without a schema change.
 */
/**
 * Run work after the HTTP response has been flushed.
 *
 * Next's `after()` keeps the serverless invocation alive past the response, so
 * this is real deferral rather than a fire-and-forget promise that the platform
 * is free to freeze mid-flight. Outside a request scope (crons, scripts) it
 * throws, so fall back to running the work inline — never silently drop it.
 */
function scheduleAfterResponse(work: () => Promise<void>) {
  const guarded = () =>
    work().catch((e) => console.error("[LeadCapture] deferred tail failed:", e));
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}

function externalIdMarker(externalId: string): string {
  return `[ext:${externalId.trim()}]`;
}

/**
 * Capture a lead from an external source (Facebook Ads, Google Ads, Generic API, etc.)
 * Creates or finds the contact, creates a lead, assigns via rules, and sends notifications.
 */
export async function captureLeadFromExternal(data: ExternalLeadData) {
  try {
    // Idempotency guard: provider webhooks (Facebook leadgen_id / Google
    // lead_id) redeliver on slow responses or non-2xx, which would otherwise
    // create duplicate leads. If we've already captured this external id,
    // return the existing lead instead of creating a new one.
    const externalId = data.externalId?.trim();
    if (externalId) {
      const existing = await prisma.lead.findFirst({
        where: { description: { contains: externalIdMarker(externalId) } },
        select: { id: true, contactId: true },
      });
      if (existing) {
        // Re-link attribution on redelivery so retried webhooks refresh the
        // campaign mapping without duplicating the row (upserts on leadId).
        if (data.attribution) {
          await attachAttributionToLead(existing.id, {
            ...data.attribution,
            source: data.attribution.source || data.source,
          });
        }
        return {
          success: true,
          leadId: existing.id,
          contactId: existing.contactId,
          deduped: true,
        };
      }
    }

    // ------------------------------------------------------------
    // Sanitise contact details BEFORE they touch the CRM.
    //
    // This is the single choke point every external capture goes through
    // (Google Ads, Facebook, the public widget, the partner API), so the guard
    // belongs here rather than in each webhook. A real case: the Google Ads
    // lead-form payload carried `string_value: false` for an unfilled column,
    // the webhook coerced it with String(...) — `??` only skips null/undefined,
    // so `false` survived — and the literal text "false" was saved as the
    // customer's phone number. Staff then tried to ring it.
    //
    // normalizePhone requires >= 7 digits and returns null for anything else,
    // so "false"/"null"/"undefined"/"N/A" are all dropped rather than stored.
    // Dropping is the right call: a blank phone is obviously missing, whereas a
    // junk phone looks real and wastes someone's time.
    // ------------------------------------------------------------
    // normalizePhone rejects junk (needs >= 7 digits) but preserves whatever
    // shape a "+" number arrived in — "+91 96113 60491" keeps its spaces. Store
    // the CANONICAL form instead, so the CRM shows one consistent number and a
    // later exact-match lookup elsewhere in the app has a stable value to hit.
    // An Indian 10-digit number is stored as +91XXXXXXXXXX; anything already
    // country-coded keeps its code.
    const validPhone = normalizePhone(data.phone);
    const cleanPhone = validPhone ? canonicalPhone(validPhone) : undefined;
    const cleanEmail = normalizeExternalEmail(data.email);
    if (data.phone && !cleanPhone) {
      console.warn(
        `[LeadCapture] Dropped an unusable phone from "${data.source}": ${JSON.stringify(data.phone)}`
      );
    }
    if (data.email && !cleanEmail) {
      console.warn(
        `[LeadCapture] Dropped an unusable email from "${data.source}": ${JSON.stringify(data.email)}`
      );
    }

    // Parse the name into first/last
    const nameParts = data.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "Unknown";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Find or create contact
    let contact = null;

    // Match an EXISTING contact format-insensitively.
    //
    // A plain `where: { phone }` equality match is wrong here, because the same
    // person arrives written several ways: Google Ads sends E.164 ("+919611360491"),
    // the widget and manual entry usually hold ten bare digits, and imports carry
    // spaces, dashes or a leading 0. An exact match misses all of those, so an ad
    // lead from an existing customer silently created a SECOND contact.
    //
    // `phoneDigits` reduces any of those to the same last-10-digit key, and this
    // is the same coarse-filter-then-exact-match pattern the rest of the app's
    // dedupe already uses — so legacy rows in any format still match.
    if (cleanEmail || cleanPhone) {
      const where = coarseContactWhere(cleanEmail, cleanPhone);
      if (where) {
        const candidates = await prisma.contact.findMany({
          where: { ...where, deletedAt: null },
          take: 25,
        });
        const matched = matchesContactKey(candidates, cleanEmail, cleanPhone);
        // COUNTRY GUARD. matchesContactKey compares the LAST 10 DIGITS, which is
        // right for +91 / 0 / spacing variants of one Indian number but collides
        // across countries: US "+1 415 555 2671" and a bare "4155552671" both
        // reduce to 4155552671. Merging two different people is worse than
        // creating a duplicate — you lose data and ring a stranger. So when BOTH
        // numbers state a country and the countries differ, reject the match.
        // (An email match is unambiguous and is never rejected by this.)
        const incomingCc = countryCodeOf(cleanPhone);
        contact =
          matched.find((c) => {
            if (cleanEmail && normalizeExternalEmail(c.email ?? undefined) === cleanEmail) return true;
            const candidateCc = countryCodeOf(c.phone);
            if (incomingCc && candidateCc && incomingCc !== candidateCc) return false;
            return true;
          }) ?? null;
      }
    }

    // Normalised once — used for the contact tag below.
    const eventTag = eventTypeTag(data.eventType);

    // WHICH CHANNEL DID THIS ACTUALLY COME FROM?
    //
    // toEnquirySource maps the integration NAME ("website", "widget") — fine
    // for an ad webhook, where the integration IS the channel. It is wrong for
    // the website, where every visitor arrives through the same form but from
    // completely different places: organic search, a paid ad, a wedding blog,
    // or by typing the URL. Crediting all of them to "Lead form" describes the
    // mechanism and hides the channel you actually buy.
    //
    // So when a capture carries attribution, let that decide. The click ids and
    // utm tags are stamped by the platform or the campaign, and outrank a
    // guess made from the integration's own name.
    const namedChannel = toEnquirySource(data.source);
    const observedChannel = classifyWebChannel(data.attribution);
    // Only let the observation override the name for FORM-ish captures. An ad
    // webhook already knows exactly which ad platform delivered it, and must
    // not be second-guessed by a stray referrer header.
    const channel =
      namedChannel === "LEAD_FORM" && observedChannel ? observedChannel : namedChannel;

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          firstName,
          lastName,
          email: cleanEmail || null,
          phone: cleanPhone || null,
          // Credit the marketing channel at the moment of capture — this is the
          // only point where we still know how this person reached us.
          enquirySource: channel,
          // Tags carry WHAT THE EVENT IS — "Wedding", "Baby Shower" — which is
          // what staff scan the list for. The capture CHANNEL used to be
          // stamped here instead, filling every row with a "google_ads" chip
          // and crowding the useful label out; the channel now has its own
          // column (enquirySource) with its own filter and export.
          tags: eventTag ? [eventTag] : [],
        },
      });
    }

    // An existing contact re-enquiring through a paid channel must record it.
    // Only fill a BLANK source: overwriting would let a later Direct walk-in
    // erase the Google Ads credit that actually won the customer.
    if (contact && !contact.enquirySource) {
      await prisma.contact
        .update({ where: { id: contact.id }, data: { enquirySource: channel } })
        .catch(() => {}); // best-effort: never fail a capture over attribution
      contact.enquirySource = channel;
    }

    // Evaluate assignment rules to auto-assign
    let assignedToId: string | null = null;
    try {
      const assignResult = await evaluateAssignmentRules({
        source: data.source,
        eventType: data.eventType,
      });
      if (assignResult) {
        assignedToId = assignResult;
      }
    } catch {
      // Assignment rules are optional; proceed without assignment
    }

    // Fallback owner — an inbound lead must NEVER land orphaned. The Leads list
    // defaults to "My leads" (assignedToId = viewer), so an unassigned lead is
    // invisible to everyone until someone thinks to switch to "All leads". That
    // silently hides ad/website leads from the people who need to act on them
    // (this is exactly why a Google Ads test lead "wasn't coming into the app").
    // If no assignment rule matched, fall back to the system admin (founder) so
    // every captured lead surfaces for someone by default.
    if (!assignedToId) {
      const fallbackOwner = await getSystemUserId();
      if (fallbackOwner) assignedToId = fallbackOwner;
    }

    // Derive an estimated value: explicit budget, else per-plate × guests.
    const estimatedValue =
      data.estimatedValue && data.estimatedValue > 0
        ? data.estimatedValue
        : data.perPlateBudget && data.guestCount
          ? data.perPlateBudget * data.guestCount
          : null;

    // Calculate lead score — now fed the FULL signal set (budget included).
    let score = 0;
    try {
      score = calculateLeadScore({
        source: mapSource(data.source),
        guestCount: data.guestCount,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        estimatedValue,
        status: "NEW",
      });
    } catch {
      // Scoring is optional
    }

    // Create the lead — stamp the speed-to-lead SLA clock on capture.
    //
    // Idempotency under concurrent webhook redelivery: the pre-check above is a
    // non-atomic find, so two parallel deliveries of the same externalId can both
    // miss it and both reach here. We re-check the marker inside a Serializable
    // transaction and create atomically; concurrent inserts for the same id then
    // conflict (write-skew), one transaction aborts, and we fall back to returning
    // the row the winner created instead of duplicating the lead + side effects.
    const systemUserId = await getSystemUserId();
    let lead: { id: string; contactId: string | null } & Record<string, any>;
    try {
      // The Serializable transaction exists for exactly one reason: to make the
      // externalId re-check and the insert atomic. That is the only race here.
      //
      // With no externalId — the public landing form — there is nothing to
      // re-check, and wrapping a lone INSERT in BEGIN/COMMIT buys several extra
      // network round-trips to Neon on the one path where a person is sitting
      // watching a spinner. So take the transaction only when it does something.
      const leadData: Prisma.LeadUncheckedCreateInput = {
        title: `${data.source} Lead — ${firstName} ${lastName}`.trim(),
        description: [
          data.message || `Auto-captured from ${data.source}`,
          externalId ? externalIdMarker(externalId) : null,
        ]
          .filter(Boolean)
          .join(" "),
        status: "NEW",
        source: mapSource(data.source) as any,
        score,
        eventType: data.eventType || null,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        guestCount: data.guestCount || null,
        estimatedValue,
        preferredVenueId: data.venueId || null,
        firstContactDue: leadSlaDeadline(),
        contactId: contact.id,
        assignedToId,
        createdById: systemUserId,
      };

      const created = externalId
        ? await prisma.$transaction(
            async (tx) => {
              const dup = await tx.lead.findFirst({
                where: { description: { contains: externalIdMarker(externalId) } },
                select: { id: true, contactId: true },
              });
              if (dup) return { tag: "existing" as const, row: dup };
              return {
                tag: "created" as const,
                row: await tx.lead.create({ data: leadData }),
              };
            },
            { isolationLevel: "Serializable" }
          )
        : {
            tag: "created" as const,
            row: await prisma.lead.create({ data: leadData }),
          };

      if (created.tag === "existing") {
        return {
          success: true,
          leadId: created.row.id,
          contactId: created.row.contactId,
          deduped: true,
        };
      }
      lead = created.row;
    } catch (txErr) {
      // A serialization conflict means a concurrent delivery for the same
      // externalId won the race — return its row instead of duplicating.
      if (externalId) {
        const winner = await prisma.lead.findFirst({
          where: { description: { contains: externalIdMarker(externalId) } },
          select: { id: true, contactId: true },
        });
        if (winner) {
          return {
            success: true,
            leadId: winner.id,
            contactId: winner.contactId,
            deduped: true,
          };
        }
      }
      throw txErr;
    }

    // ---------------- everything below is POST-WRITE ----------------
    // The contact and the lead now exist. Nothing after this point changes what
    // we return, so on the landing-form path it runs after the response.
    const runTail = async () => {
      // First-touch marketing attribution (best-effort; helper swallows errors).
      // Awaited so the campaign linkage isn't dropped on a serverless freeze.
      if (data.attribution) {
        await attachAttributionToLead(lead.id, {
          ...data.attribution,
          source: data.attribution.source || data.source,
        });
      }

      // Log activity
      logActivity({
        action: "CREATE",
        entityType: "lead",
        entityId: lead.id,
        changes: { source: data.source, autoCapture: true },
        userId: assignedToId || "system",
      });

      // Notify assigned agent
      if (assignedToId) {
        notify({
          userId: assignedToId,
          title: "New Lead Captured",
          message: `New ${data.source} lead: ${firstName} ${lastName}`,
          type: "LEAD_ASSIGNED",
          actionUrl: `/leads`,
        });
      }

      // Check for auto-welcome config
      try {
        const welcomeConfig = await prisma.autoWelcomeConfig.findUnique({
          where: { leadSource: mapSource(data.source) as any },
        });

        if (welcomeConfig?.isEnabled && contact.phone) {
          // Schedule welcome message (delayed or immediate)
          if (welcomeConfig.delayMinutes === 0) {
            // NOT awaited. This is an outbound call to WhatsApp's API, made
            // AFTER the lead is already durably saved — so the visitor was
            // sitting in a spinner waiting on a third party that has nothing to
            // do with whether their enquiry reached us. If WhatsApp was slow the
            // whole request blew the function timeout and the lead was reported
            // as failed. A welcome message is worth sending; it is not worth an
            // enquiry.
            void sendWelcomeWhatsApp(
              contact.phone,
              welcomeConfig.templateName,
              firstName,
              contact.id
            ).catch((e) => console.error("[CAPTURE] welcome WhatsApp failed", e));
          } else {
            // For delayed messages, create a scheduled task
            const sendAt = new Date(Date.now() + welcomeConfig.delayMinutes * 60 * 1000);
            await prisma.task.create({
              data: {
                title: `Send welcome message to ${firstName} ${lastName}`,
                description: `Auto-welcome via template: ${welcomeConfig.templateName}`,
                dueDate: sendAt,
                priority: "HIGH",
                status: "TODO",
                assigneeId: assignedToId || (await getSystemUserId()),
                creatorId: await getSystemUserId(),
              },
            });
          }
        }
      } catch {
        // Welcome message is optional; don't fail the lead capture
      }

      // Intake: instant email auto-reply (via LEAD_CREATED workflows) + the
      // "call now" task + auto-enrolment into matching nurture cadences.
      await runLeadIntake({
        lead: {
          id: lead.id,
          contactId: contact.id,
          source: lead.source,
          eventType: lead.eventType,
          status: lead.status,
          guestCount: lead.guestCount,
          score: lead.score,
          estimatedValue: estimatedValue,
        },
        triggeredByUserId: assignedToId ?? undefined,
      });

      // Message-intent classification on the first-touch inbound message so a
      // brand-new READY_TO_BUY lead also boosts + pings. Best-effort, never blocks.
      if (data.message && data.message.trim().length > 0) {
        try {
          // Also not awaited: this calls an AI provider to classify the
          // enquiry's intent. Useful, entirely optional, and absolutely not
          // something a customer should wait on to be told their message was
          // received.
          const { stampMessageIntent } = await import("@/lib/ai/intent-stamp");
          void stampMessageIntent({
            text: data.message,
            leadId: lead.id,
            contactId: contact.id,
          }).catch((e) => console.error("[CAPTURE] intent stamp failed", e));
        } catch (e) {
          console.error("[LeadCapture] intent-stamp error:", e);
        }
      }

      // Referral-code ingestion for non-portal inbound channels (WhatsApp webhook
      // / generic API). The public portal path calls recordReferralIngestion
      // directly; this covers the other channels. Wrapped so it never blocks capture.
      try {
        const referralCode =
          (typeof data.customFields?.referralCode === "string"
            ? data.customFields.referralCode
            : undefined) ??
          (data.source.toLowerCase() === "referral" &&
          typeof data.customFields?.code === "string"
            ? data.customFields.code
            : undefined);

        if (referralCode) {
          const { resolveReferralPartnerByCode, recordReferralIngestion } =
            await import("@/lib/referral/ingest");
          const partner = await resolveReferralPartnerByCode(referralCode);
          if (partner) {
            await recordReferralIngestion({
              partnerId: partner.id,
              leadId: lead.id,
              contactId: contact.id,
              prospectName: data.name,
              prospectPhone: cleanPhone ?? null,
              prospectEmail: cleanEmail ?? null,
              eventType: data.eventType ?? null,
              eventDate: data.eventDate ? new Date(data.eventDate) : null,
              guestCount: data.guestCount ?? null,
              message: data.message ?? null,
            });
          }
        }
      } catch (e) {
        console.error("[LeadCapture] referral-ingestion error:", e);
      }
    };

    if (data.deferTail) {
      scheduleAfterResponse(runTail);
    } else {
      await runTail();
    }

    return { success: true, leadId: lead.id, contactId: contact.id };
  } catch (error) {
    console.error("[LeadCapture] Error:", error);
    return { success: false, error: "Failed to capture lead" };
  }
}

/**
 * Map string source to LeadSource enum value
 */
function mapSource(source: string): string {
  const sourceMap: Record<string, string> = {
    facebook: "FACEBOOK_ADS",
    facebook_ads: "FACEBOOK_ADS",
    google: "GOOGLE_ADS",
    google_ads: "GOOGLE_ADS",
    indiamart: "INDIAMART",
    justdial: "JUSTDIAL",
    website: "WEBSITE",
    referral: "REFERRAL",
    social_media: "SOCIAL_MEDIA",
    whatsapp: "SOCIAL_MEDIA",
    walk_in: "WALK_IN",
    phone: "PHONE_INQUIRY",
    email: "EMAIL",
  };
  return sourceMap[source.toLowerCase()] || "OTHER";
}

/**
 * Get system user ID (first SUPER_ADMIN or ADMIN)
 */
/**
 * The fallback owner for anything that arrives without one.
 *
 * MEMOISED, because a single capture called this FOUR times and each call was
 * its own database round-trip for a value that cannot change mid-request. On a
 * serverless function talking to a remote Postgres, a round-trip is
 * hundreds of milliseconds — so this alone was costing over a second of the
 * time a customer spent staring at a spinner.
 *
 * The cache lives for the lifetime of the process, which on serverless is one
 * warm instance. A newly-promoted admin is picked up when the instance
 * recycles; the value is "which admin owns orphans", not something that needs
 * to be correct to the second. An empty result is NOT cached, so a genuine
 * lookup failure retries rather than sticking.
 */
let systemUserIdCache: string | null = null;

export async function getSystemUserId(): Promise<string> {
  if (systemUserIdCache) return systemUserIdCache;
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });
  const id = admin?.id || "";
  if (id) systemUserIdCache = id;
  return id;
}

/**
 * Send a WhatsApp welcome message via the Meta Cloud API.
 *
 * Strategy: if `templateName` is set to a real WhatsApp template name, send
 * as a template (preferred for outside the 24-hour customer service window).
 * Falls back to a plain-text message when only `firstName` is available.
 *
 * Logs the outbound to `WhatsAppMessage` so the message shows up in the
 * unified inbox just like a manually-sent message.
 */
async function sendWelcomeWhatsApp(
  phone: string,
  templateName: string,
  firstName: string,
  contactId?: string
) {
  try {
    const text =
      templateName && templateName.trim().length > 0
        ? `Hi ${firstName}, thanks for reaching out to Veloria Grand. ` +
          `One of our event consultants will be in touch shortly. ` +
          `For urgent queries, reply to this message.`
        : `Hi ${firstName}, thanks for getting in touch with Veloria Grand!`;

    const result = await sendWhatsApp({
      to: phone,
      template: templateName || undefined,
      message: text,
      params: { name: firstName },
    });

    // Mirror to WhatsAppMessage log if we know the contact
    if (contactId) {
      try {
        await prisma.whatsAppMessage.create({
          data: {
            direction: "OUTBOUND",
            content: text,
            status: result.success ? "SENT" : "FAILED",
            whatsappId: result.messageId || null,
            contactId,
          },
        });
      } catch {
        // Logging failure must not block the welcome flow
      }
    }

    if (!result.success) {
      console.error(`[AutoWelcome] Failed to send to ${phone}:`, result.error);
    }
  } catch (error) {
    console.error("[AutoWelcome] Failed to send WhatsApp:", error);
  }
}
