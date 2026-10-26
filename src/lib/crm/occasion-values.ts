import { prisma } from "@/lib/prisma";
import { OCCASION_NONE, occasionKey, rawValuesForOccasion } from "@/lib/crm/occasion";
import type { LeadListFilters } from "@/lib/crm/lead-filters";

// Shared by the leads list (lead.actions) and the CSV export (export.actions):
// an occasion filter must resolve to the same spellings in both, or the file
// and the screen disagree. Export used to skip this and got `in: []` — an
// occasion-filtered export came out empty.

/**
 * Lead.eventType is free text, so an occasion filter has to be resolved against
 * the spellings actually on record before it can become SQL. One tiny DISTINCT
 * query, and only when the filter is in use. For "NONE" it collects the
 * whitespace-only values, which mean "not recorded" just as null does.
 */
export async function withOccasionValues<T extends LeadListFilters | undefined>(params: T): Promise<T> {
  const occasion = params?.occasion?.trim();
  if (!params || !occasion) return params;
  const rows = await prisma.lead.findMany({
    where: { deletedAt: null, eventType: { not: null } },
    distinct: ["eventType"],
    select: { eventType: true },
  });
  const distinctRaw = rows.map((r) => r.eventType);
  const occasionValues =
    occasion === OCCASION_NONE
      ? distinctRaw.filter((raw): raw is string => raw != null && occasionKey(raw) == null)
      : rawValuesForOccasion(occasion, distinctRaw);
  return { ...params, occasionValues };
}
