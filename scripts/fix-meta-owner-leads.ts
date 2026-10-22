/**
 * Re-read the venue / locality / city / stage / interest of BD leads that came
 * from Meta owner-partnership forms, using the raw answers already stored on
 * MetaLeadCapture.rawFieldData — no new download needed.
 *
 * Only leads nobody has worked yet are touched: status NEW, no contact
 * attempts, no activities, no site visits. Everything else is left alone.
 *
 *   DATABASE_URL=… npx tsx scripts/fix-meta-owner-leads.ts [--dry]
 */
import { prisma } from "@/lib/prisma";
import { mapOwnerLead } from "@/lib/meta/owner-lead";
import type { MetaLeadPayload } from "@/lib/meta/field-map";

async function main() {
  const dry = process.argv.includes("--dry");
  const captures = await prisma.metaLeadCapture.findMany({
    where: { acqLeadId: { not: null }, pipeline: "owner_partnership" },
    select: {
      acqLeadId: true,
      formName: true,
      campaignName: true,
      adsetName: true,
      platform: true,
      rawFieldData: true,
    },
  });

  const summary = {
    captures: captures.length,
    leadMissing: 0,
    alreadyWorked: 0,
    unchanged: 0,
    updated: 0,
    byCity: {} as Record<string, number>,
    venueNamed: 0,
    localityRead: 0,
    interested: 0,
    greenfield: 0,
  };

  for (const c of captures) {
    const lead = await prisma.acqLead.findFirst({
      where: { id: c.acqLeadId!, deletedAt: null },
      select: {
        id: true,
        status: true,
        contactAttempts: true,
        propertyName: true,
        locality: true,
        city: true,
        propertyStage: true,
        qualOwnerInterested: true,
        notes: true,
        _count: { select: { activities: true, siteVisits: true } },
      },
    });
    if (!lead) {
      summary.leadMissing++;
      continue;
    }
    if (lead.status !== "NEW" || lead.contactAttempts > 0 || lead._count.activities > 0 || lead._count.siteVisits > 0) {
      summary.alreadyWorked++;
      continue;
    }

    const payload: MetaLeadPayload = {
      field_data: (c.rawFieldData ?? []) as unknown as MetaLeadPayload["field_data"],
      campaign_name: c.campaignName ?? undefined,
      adset_name: c.adsetName ?? undefined,
      platform: c.platform ?? undefined,
    };
    const m = mapOwnerLead(payload, c.formName);

    summary.byCity[m.city] = (summary.byCity[m.city] ?? 0) + 1;
    if (m.propertyName !== "Venue not named") summary.venueNamed++;
    if (m.locality !== "Not given") summary.localityRead++;
    if (m.qualOwnerInterested) summary.interested++;
    if (m.propertyStage === "GREENFIELD") summary.greenfield++;

    const data = {
      propertyName: m.propertyName,
      locality: m.locality,
      city: m.city,
      propertyStage: m.propertyStage,
      qualOwnerInterested: m.qualOwnerInterested,
      notes: m.notes,
    };
    const same =
      lead.propertyName === data.propertyName &&
      lead.locality === data.locality &&
      lead.city === data.city &&
      lead.propertyStage === data.propertyStage &&
      lead.qualOwnerInterested === data.qualOwnerInterested &&
      lead.notes === data.notes;
    if (same) {
      summary.unchanged++;
      continue;
    }
    if (!dry) await prisma.acqLead.update({ where: { id: lead.id }, data });
    summary.updated++;
  }

  console.log(JSON.stringify({ dryRun: dry, ...summary }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
