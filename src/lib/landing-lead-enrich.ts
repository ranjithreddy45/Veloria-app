import { prisma } from "@/lib/prisma";
import { resolveLeadArea } from "@/lib/crm/areas";
import { getDefaultLeadOwnerId } from "@/lib/crm/default-lead-owner";
import { evaluateAssignmentRules } from "@/lib/assignment/evaluate";
import { scheduleLeadsAssignedNotify } from "@/lib/crm/lead-assigned-notify";

// ============================================================
// Adding step-2 detail to a lead the landing form already created.
//
// The two-step form saves after step 1 (name + mobile) so a visitor who
// abandons halfway is still a contactable lead — previously they were nothing
// at all. Step 2 then fills in the event details.
//
// EVERYTHING HERE IS ADDITIVE AND NON-DESTRUCTIVE. Step 2 is untrusted public
// input arriving after the fact, so it may only fill BLANKS. It must never
// overwrite something already recorded: between step 1 and step 2 a rep may
// already have opened the lead and typed a real event date, and a stale form
// tab must not be able to wipe that.
// ============================================================

/**
 * The word worth searching a venue name for, from the website's own wording.
 *
 * The site offers "Hosa Road (Singasandra)" and "Begur — New Property"; the CRM
 * calls the same halls something else entirely. The bracketed aside and the
 * marketing suffix after a dash are noise, so strip both and search on what is
 * left. "Either — suggest best available" expresses NO preference and must not
 * match a hall called "Either" or, worse, the first venue alphabetically.
 *
 * Returns null when there is nothing worth searching for.
 */
export function venueMatchKey(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(either|any|not sure|no preference)/i.test(v)) return null;
  const key = v.replace(/\(.*?\)/g, "").split(/[—–-]/)[0].trim();
  // One or two characters would match almost any venue name; that is worse
  // than not matching at all, because it silently files the lead to a hall
  // the visitor never asked for.
  return key.length >= 3 ? key : null;
}

/** "50–100" / "Not sure yet" → a usable number (midpoint), or undefined. */
function parseGuests(v: unknown): number | undefined {
  const s = String(v ?? "").replace(/[–—]/g, "-");
  const nums = s.match(/\d+/g);
  if (!nums || nums.length === 0) return undefined;
  if (nums.length === 1) return Number(nums[0]);
  return Math.round((Number(nums[0]) + Number(nums[1])) / 2);
}

/** A date the visitor picked, or undefined if it isn't a real calendar day. */
function parseEventDate(iso: string | undefined): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  // Reject rollover: Date accepts 2026-02-31 and silently returns 3 March.
  return d.toISOString().slice(0, 10) === iso ? d : undefined;
}

export interface EnrichInput {
  email?: string;
  eventType?: string;
  guests?: unknown;
  date?: string;
  /** What the visitor picked, as free text ("Hosa Road (Singasandra)"). */
  venueLocation?: string;
}

export async function enrichLandingLead(leadId: string, input: EnrichInput): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: {
      id: true,
      eventType: true,
      eventDate: true,
      guestCount: true,
      preferredVenueId: true,
      description: true,
      area: true,
      areaSource: true,
      assignedToId: true,
      lastTouchedAt: true,
      source: true,
      status: true,
      score: true,
      contactId: true,
      contact: { select: { id: true, email: true } },
    },
  });
  if (!lead) return; // Deleted between the two steps — nothing to do.

  // Match the visitor's venue choice to a real hall.
  //
  // They pick from a WORDING on the website ("Hosa Road (Singasandra)"), which
  // is not the venue's name in the CRM. So: try to resolve it, and if nothing
  // matches, keep the raw text on the lead rather than dropping the preference
  // — a rep can read "Begur" and act on it even when no Venue row exists yet.
  let preferredVenueId: string | undefined;
  const venueText = input.venueLocation?.trim();
  if (venueText) {
    const key = venueMatchKey(venueText);
    if (key) {
      const v = await prisma.venue
        .findFirst({
          where: { isActive: true, name: { contains: key, mode: "insensitive" } },
          select: { id: true },
        })
        .catch(() => null);
      if (v) preferredVenueId = v.id;
    }
  }

  const guests = parseGuests(input.guests);
  const eventDate = parseEventDate(input.date);
  const eventType = input.eventType?.trim() || undefined;

  // Fill blanks only. `?? undefined` on each existing value is the guard: if a
  // field already holds anything, it is left exactly as it is.
  const leadData: Record<string, unknown> = {};
  if (eventType && !lead.eventType) leadData.eventType = eventType;
  if (eventDate && !lead.eventDate) leadData.eventDate = eventDate;
  if (guests != null && !lead.guestCount) leadData.guestCount = guests;
  if (preferredVenueId && !lead.preferredVenueId) leadData.preferredVenueId = preferredVenueId;
  // Keep the visitor's own words when we could not resolve them to a hall.
  if (venueText && !preferredVenueId && !lead.description?.includes("Preferred venue:")) {
    leadData.description = `${lead.description ? lead.description + "\n" : ""}Preferred venue: ${venueText}`;
  }

  // Where in Bengaluru (crm/areas). Step 1 had no venue, so the area is first
  // known here. Never over a person's choice.
  let newArea: string | null = null;
  if (!lead.area && lead.areaSource !== "manual" && venueText) {
    const venueName = preferredVenueId
      ? ((await prisma.venue.findUnique({ where: { id: preferredVenueId }, select: { name: true } }))?.name ?? null)
      : null;
    const r = resolveLeadArea({ given: venueText, venueName });
    if (r.area) {
      newArea = r.area;
      leadData.area = r.area;
      leadData.areaSource = r.source;
    }
  }

  if (Object.keys(leadData).length > 0) {
    await prisma.lead.update({ where: { id: lead.id }, data: leadData });
  }

  // Step 1 routed the lead before its area was known, so it usually sits with
  // the default owner. If an AREA rule now matches, hand it over — only while
  // nobody has worked it yet and it is still with the default owner.
  if (newArea && !lead.lastTouchedAt && lead.assignedToId) {
    try {
      const fallback = await getDefaultLeadOwnerId();
      if (fallback && lead.assignedToId === fallback) {
        const pick = await evaluateAssignmentRules(
          { id: lead.id, source: lead.source, status: lead.status, score: lead.score ?? 0, eventType: eventType ?? lead.eventType ?? "", area: newArea },
          { onlyField: "area" }
        );
        if (pick && pick !== lead.assignedToId) {
          const moved = await prisma.lead.updateMany({
            where: { id: lead.id, assignedToId: lead.assignedToId, lastTouchedAt: null },
            data: { assignedToId: pick },
          });
          if (moved.count === 1) {
            scheduleLeadsAssignedNotify({ leadIds: [lead.id], assigneeId: pick, assignedById: null, isNew: true });
          }
        }
      }
    } catch (e) {
      console.error("[enrichLandingLead] area routing failed", e);
    }
  }

  // The contact's email, same blanks-only rule. A person who typed an address
  // in step 2 is telling us something new; a person whose record already has
  // one is not authorising a change to it from a public form.
  if (input.email && lead.contact && !lead.contact.email) {
    await prisma.contact
      .update({ where: { id: lead.contact.id }, data: { email: input.email } })
      .catch(() => {
        /* unique-email collision with another contact — keep the lead intact */
      });
  }
}
