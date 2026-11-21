/**
 * Load the Google Ads brief's routing table (Nov 2026) into Settings ->
 * Property routing. Idempotent: upserts by key / campaign id.
 *
 *   npx tsx scripts/seed-property-routing.ts            # dry run: prints the plan
 *   npx tsx scripts/seed-property-routing.ts --apply    # writes it
 *
 * Owners are matched by FIRST NAME against active users who can own leads. A
 * name with no match, or with more than one, is left empty and reported:
 * pick that owner on the settings page instead. The shared queue ("other")
 * is never guessed: set its owner on the settings page.
 *
 * Campaigns marked "read from account" in the brief have no id yet, so they
 * are not loaded. Add them on the settings page (the number after
 * campaignId= in the Google Ads URL). Routing stays OFF until the first
 * property with an owner exists, so a dry run or a partial load is safe.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const PROPERTIES: { key: string; name: string; owner: string | null; terms: string[]; corporateOnly?: boolean }[] = [
  { key: "hosa_road", name: "Veloria Grand Hosa Road", owner: "Nayana", terms: ["hosa road", "singasandra"] },
  { key: "electronic_city", name: "Veloria Grand Electronic City", owner: "Anshu", terms: ["electronic city", "e city", "ecity"] },
  { key: "hsr", name: "Veloria Grand HSR Layout", owner: "Sunitha", terms: ["hsr layout"] },
  { key: "indiranagar", name: "Veloria Grand Indiranagar", owner: "Meera", terms: ["indiranagar", "indira nagar"] },
  { key: "bellandur", name: "Veloria Grand Bellandur", owner: "Nivetha", terms: ["bellandur"], corporateOnly: true },
  { key: "yelahanka", name: "Veloria Grand Yelahanka", owner: "Sunitha", terms: ["yelahanka"] },
  { key: "kr_puram", name: "Veloria Grand KR Puram", owner: "Sunitha", terms: ["k r puram", "krishnarajapuram"] },
  { key: "other", name: "Shared queue (no property)", owner: null, terms: [] },
];

// Only the ids the brief actually lists. HSR, Corporate | Bengaluru,
// Yelahanka, Hosa Road, Wedding and Brand: "read from account".
const CAMPAIGNS: { id: string; name: string; property: string | null }[] = [
  { id: "24526650623", name: "VG | Search | Electronic City", property: "electronic_city" },
  { id: "24521600526", name: "VG | Search | Indiranagar", property: "indiranagar" },
  { id: "24526650626", name: "VG | Search | KR Puram", property: "kr_puram" },
  { id: "24526650632", name: "VG | Search | Bellandur Corporate", property: "bellandur" },
];

async function ownerId(first: string | null): Promise<{ id: string | null; note: string }> {
  if (!first) return { id: null, note: "set on the settings page" };
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"] as never },
      name: { startsWith: first, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });
  const exact = users.filter((u) => (u.name ?? "").trim().split(/\s+/)[0].toLowerCase() === first.toLowerCase());
  if (exact.length === 1) return { id: exact[0].id, note: `${exact[0].name}` };
  if (exact.length === 0) return { id: null, note: `NO active user named ${first}: pick on the settings page` };
  return { id: null, note: `${exact.length} users named ${first}: pick on the settings page` };
}

async function main() {
  console.log(APPLY ? "APPLYING" : "DRY RUN (add --apply to write)");
  for (const [i, p] of PROPERTIES.entries()) {
    const o = await ownerId(p.owner);
    console.log(`property ${p.key.padEnd(16)} owner: ${o.note}${p.corporateOnly ? "  [corporate only]" : ""}`);
    if (!APPLY) continue;
    const existing = await prisma.leadProperty.findUnique({ where: { key: p.key }, select: { ownerId: true } });
    const data = {
      name: p.name,
      matchTerms: p.terms,
      corporateOnly: !!p.corporateOnly,
      sortOrder: i,
      // Never overwrite an owner someone already chose on the settings page.
      ownerId: existing?.ownerId ?? o.id,
    };
    await prisma.leadProperty.upsert({ where: { key: p.key }, create: { key: p.key, ...data }, update: data });
  }
  for (const c of CAMPAIGNS) {
    console.log(`campaign ${c.id} ${c.name} -> ${c.property ?? "location answer / shared queue"}`);
    if (!APPLY) continue;
    await prisma.leadCampaignRoute.upsert({
      where: { campaignId: c.id },
      create: { campaignId: c.id, campaignName: c.name, propertyKey: c.property },
      update: { campaignName: c.name, propertyKey: c.property },
    });
  }
  console.log("Still to add on the settings page: campaign ids for HSR, Corporate | Bengaluru, Yelahanka, Hosa Road, Wedding, Brand; the shared-queue owner.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
