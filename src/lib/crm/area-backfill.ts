import { prisma } from "@/lib/prisma";
import { resolveLeadArea } from "@/lib/crm/areas";

// ============================================================
// Fill Lead.area on leads captured before the field existed (Nov 2026), from
// their preferred venue and the form answers kept in the description.
//
// Runs in the 5-minute fast lane, a batch at a time, oldest first. A lead that
// names no area is marked areaSource "none" so it is not read again. It only
// ever SETS the area on a lead that has none (guarded update): it never
// overwrites an area a person or capture already set, and never touches the
// owner — existing leads keep whoever has them.
// ============================================================

export async function backfillLeadAreas(limit = 500): Promise<{ scanned: number; filled: number }> {
  const leads = await prisma.lead.findMany({
    where: { areaSource: null },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, description: true, preferredVenue: { select: { name: true } } },
  });
  if (leads.length === 0) return { scanned: 0, filled: 0 };

  // Group by outcome so a batch is a handful of updates, not one per lead.
  const groups = new Map<string, { area: string | null; source: string; ids: string[] }>();
  for (const l of leads) {
    const r = resolveLeadArea({ venueName: l.preferredVenue?.name ?? null, text: l.description });
    const k = `${r.area ?? ""}|${r.source}`;
    const g = groups.get(k) ?? { area: r.area, source: r.source, ids: [] };
    g.ids.push(l.id);
    groups.set(k, g);
  }

  let filled = 0;
  for (const g of groups.values()) {
    const res = await prisma.lead.updateMany({
      where: { id: { in: g.ids }, areaSource: null },
      data: { area: g.area, areaSource: g.source },
    });
    if (g.area) filled += res.count;
  }
  return { scanned: leads.length, filled };
}
