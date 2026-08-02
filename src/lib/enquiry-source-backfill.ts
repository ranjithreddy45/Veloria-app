import { prisma } from "@/lib/prisma";
import { toEnquirySource, eventTypeTag } from "@/lib/enquiry-source";
import { usableValue } from "@/lib/webhook-field";

// ============================================================
// Repair pass for enquiry (Contact) attribution data.
//
// Why a cron backstop rather than a migration: there is no way to run a one-off
// script against the production database from the dev machine, and Vercel's
// build only runs `prisma db push`. Registering this in the daily lane means
// the repair happens by itself, and keeps happening — so a row created by some
// path that forgets to stamp the channel still gets fixed rather than sitting
// wrong forever.
//
// It does three things, all idempotent and all narrowly scoped:
//
//   1. FILLS a blank enquirySource from evidence we already hold.
//   2. REPLACES the channel word in `tags` with the EVENT TYPE — what the tag
//      is actually for ("Wedding", "Baby Shower"), and what staff scan for.
//   3. CLEARS junk phone values ("FALSE", "N/A") left by the old ad-webhook bug.
//
// ATTRIBUTION RULE: only ever derive from something real — the channel tag
// written at capture, or the first lead's own recorded source. A contact with
// neither is left NULL and reads "Not recorded". Inventing "Direct" would put a
// fabricated number in a channel report someone spends money against.
// ============================================================

/** Cap per run so one pass can't blow the cron's time budget on a big table. */
const BATCH = 2000;

/**
 * Tag values that are really a capture channel, not a label a person chose.
 *
 * An EXACT-MATCH allowlist on purpose. A prefix or `includes` rule would eat
 * staff tags — "Website shoot", "Walk-in visit" — and tags are hand-entered
 * data that cannot be regenerated. Anything not on this list is left alone.
 *
 * Sources: `data.source.toLowerCase()` from captureLeadFromExternal, plus the
 * literals the configurator and public-hold forms used.
 */
const CHANNEL_TAGS = new Set([
  "google_ads",
  "google ads",
  "googleads",
  "facebook_ads",
  "facebook ads",
  "facebookads",
  "instagram",
  "meta",
  "paid_social",
  "website",
  "widget",
  "web_form",
  "webform",
  "landing_page",
  "configurator",
  "public-hold",
  "walk_in",
  "walkin",
  "justdial",
  "indiamart",
  "wedmegood",
  "weddingwire",
]);

/** The same set as an array, for `tags: { hasSome: [...] }` count queries. */
export const CHANNEL_TAG_LIST: string[] = [...CHANNEL_TAGS];

/** True when this tag is a capture channel rather than a human label. */
export function isChannelTag(tag: string): boolean {
  return CHANNEL_TAGS.has(tag.trim().toLowerCase());
}

export interface EnquiryRepairResult {
  scanned: number;
  /** enquirySource filled in. */
  sourceFilled: number;
  /** Contacts that had at least one channel tag removed. */
  tagsCleaned: number;
  /** Channel tags that were REPLACED with the event type, not just dropped. */
  tagsRetyped: number;
  /** Junk phone values ("FALSE", "N/A") cleared. */
  phonesCleared: number;
  /** Left NULL on purpose — no tag and no lead to derive from. */
  skippedNoEvidence: number;
}

export async function backfillEnquirySource(): Promise<EnquiryRepairResult> {
  // Anything that still needs one of the three repairs. A row that is already
  // clean matches none of these and is never re-read.
  const contacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { enquirySource: null },
        { tags: { isEmpty: false } },
        { phone: { not: null } },
      ],
    },
    select: {
      id: true,
      tags: true,
      phone: true,
      enquirySource: true,
      // The FIRST lead is the one that won the customer — a later lead may
      // have arrived through a different channel, but the credit belongs to
      // the one that brought them in.
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { source: true, eventType: true },
      },
    },
    take: BATCH,
  });

  const result: EnquiryRepairResult = {
    scanned: contacts.length,
    sourceFilled: 0,
    tagsCleaned: 0,
    tagsRetyped: 0,
    phonesCleared: 0,
    skippedNoEvidence: 0,
  };

  for (const c of contacts) {
    const data: Record<string, unknown> = {};

    // ---- 1 + 2. Channel tags: read the evidence, THEN drop the tag ----
    const channelTags = c.tags.filter(isChannelTag);
    const keptTags = c.tags.filter((t) => !isChannelTag(t));

    if (!c.enquirySource) {
      // Prefer the tag: it was written at capture from the same string that now
      // feeds enquirySource, so it is first-hand evidence and survives even
      // when the lead row is gone. Fall back to the first lead's source.
      const evidence = channelTags[0] ?? c.leads[0]?.source ?? null;
      if (evidence) {
        data.enquirySource = toEnquirySource(evidence);
      } else {
        result.skippedNoEvidence++;
      }
    }

    // Put the EVENT TYPE where the channel word used to be. Only for rows that
    // actually carried a channel tag: those are the captured enquiries that
    // should have been labelled with the event all along. Contacts that
    // deliberately have no tags are left with none — this is a correction, not
    // a licence to tag everybody.
    let retyped = false;
    if (channelTags.length > 0) {
      const eventTag = eventTypeTag(c.leads[0]?.eventType);
      // Don't duplicate a label the staff already added themselves.
      const alreadyLabelled = keptTags.some(
        (t) => t.trim().toLowerCase() === eventTag?.toLowerCase()
      );
      if (eventTag && !alreadyLabelled) {
        data.tags = [eventTag, ...keptTags];
        retyped = true;
      } else {
        data.tags = keptTags;
      }
    }

    // ---- 3. Junk phone left by the old ad-webhook bug ----
    // usableValue is the same rule the webhooks now apply on the way in, so
    // "FALSE"/"N/A"/"-" are recognised as absent. Clearing is right: a blank
    // phone is obviously missing, whereas "FALSE" looks real and gets dialled.
    const junkPhone = c.phone !== null && usableValue(c.phone) === null;
    if (junkPhone) data.phone = null;

    if (Object.keys(data).length === 0) continue;

    try {
      await prisma.contact.update({ where: { id: c.id }, data });
      if (data.enquirySource) result.sourceFilled++;
      if (data.tags) result.tagsCleaned++;
      if (retyped) result.tagsRetyped++;
      if (junkPhone) result.phonesCleared++;
    } catch {
      // Row changed under us (someone editing it in the app) — skip; the next
      // nightly run picks it up again.
    }
  }

  return result;
}
