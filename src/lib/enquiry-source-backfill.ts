import { prisma } from "@/lib/prisma";
import { toEnquirySource } from "@/lib/enquiry-source";

// ============================================================
// Backfill Contact.enquirySource from the contact's FIRST lead.
//
// Why a cron backstop rather than a migration: the column ships empty on every
// existing row, and a one-off script can't be run against production from here.
// Registering it in the daily lane makes the fill happen by itself, and keeps
// happening — so a contact created by some path that forgets to stamp the
// channel still gets attributed rather than sitting blank forever.
//
// ATTRIBUTION RULE: only ever derive from a lead's own recorded `source`, which
// is real captured data. A contact with NO leads is left NULL and reads as
// "Not recorded" — inventing "Direct" for it would put a fabricated number in a
// channel report someone spends money against.
//
// Idempotent: only touches rows where enquirySource IS NULL, so a second run
// over the same data is a no-op.
// ============================================================

/** Cap per run so one pass can't blow the cron's time budget on a big table. */
const BATCH = 2000;

export async function backfillEnquirySource(): Promise<{
  scanned: number;
  filled: number;
  skippedNoLead: number;
}> {
  const contacts = await prisma.contact.findMany({
    where: { enquirySource: null, deletedAt: null },
    select: {
      id: true,
      // The FIRST lead is the one that won the customer — a later lead may have
      // arrived through a different channel, but the credit belongs to the one
      // that brought them in.
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { source: true },
      },
    },
    take: BATCH,
  });

  let filled = 0;
  let skippedNoLead = 0;

  for (const c of contacts) {
    const leadSource = c.leads[0]?.source;
    if (!leadSource) {
      skippedNoLead++;
      continue;
    }
    await prisma.contact
      .update({
        // Re-assert the null guard so a concurrent write (someone setting it by
        // hand while this runs) is never overwritten.
        where: { id: c.id, enquirySource: null },
        data: { enquirySource: toEnquirySource(leadSource) },
      })
      .then(() => {
        filled++;
      })
      .catch(() => {
        /* row changed under us — leave whatever the other writer chose */
      });
  }

  return { scanned: contacts.length, filled, skippedNoLead };
}
