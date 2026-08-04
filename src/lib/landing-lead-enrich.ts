import { prisma } from "@/lib/prisma";

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
}

export async function enrichLandingLead(leadId: string, input: EnrichInput): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: {
      id: true,
      eventType: true,
      eventDate: true,
      guestCount: true,
      contactId: true,
      contact: { select: { id: true, email: true } },
    },
  });
  if (!lead) return; // Deleted between the two steps — nothing to do.

  const guests = parseGuests(input.guests);
  const eventDate = parseEventDate(input.date);
  const eventType = input.eventType?.trim() || undefined;

  // Fill blanks only. `?? undefined` on each existing value is the guard: if a
  // field already holds anything, it is left exactly as it is.
  const leadData: Record<string, unknown> = {};
  if (eventType && !lead.eventType) leadData.eventType = eventType;
  if (eventDate && !lead.eventDate) leadData.eventDate = eventDate;
  if (guests != null && !lead.guestCount) leadData.guestCount = guests;

  if (Object.keys(leadData).length > 0) {
    await prisma.lead.update({ where: { id: lead.id }, data: leadData });
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
