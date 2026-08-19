"use server";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

// ============================================================
// Marketing attribution report — leads → qualified → booked, by campaign.
// The weekly truth-view: Google Ads supplies the cost side, this supplies the
// outcome side (qualification rate, bookings, booking value per campaign).
// ============================================================

export interface AttributionReportRow {
  campaignId: string; // gadsCampaignId or utm campaign or "(none)"
  label: string;
  leads: number;
  qualified: number;
  qualificationRate: number; // 0..1
  won: number;
  bookingValue: number;
  avgBookingValue: number;
}

export async function getMarketingAttribution(): Promise<
  | { success: true; rows: AttributionReportRow[]; totals: AttributionReportRow }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.user) return { success: false as const, error: "Unauthorized" };
  if (!hasPermission(session.user.role as string, "leads:read")) {
    return { success: false as const, error: "Insufficient permissions" };
  }

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null },
    take: 10000,
    select: {
      status: true,
      leadQuality: true,
      bookingValue: true,
      attribution: {
        select: {
          gadsCampaignId: true,
          utmCampaign: true,
          campaign: true,
          campaignRef: { select: { name: true } },
        },
      },
    },
  });

  type Acc = { label: string; leads: number; qualified: number; won: number; bookingValue: number };
  const groups = new Map<string, Acc>();

  for (const l of leads) {
    const a = l.attribution;
    const key = a?.gadsCampaignId || a?.utmCampaign || a?.campaign || "(no campaign)";
    const label =
      a?.campaignRef?.name ||
      (a?.gadsCampaignId ? `Campaign ${a.gadsCampaignId}` : a?.utmCampaign || a?.campaign) ||
      "(no campaign)";

    const g = groups.get(key) ?? { label, leads: 0, qualified: 0, won: 0, bookingValue: 0 };
    g.leads += 1;
    const isWon = l.status === "WON";
    if (l.leadQuality === "QUALIFIED" || isWon) g.qualified += 1;
    if (isWon) {
      g.won += 1;
      g.bookingValue += l.bookingValue ? Number(l.bookingValue) : 0;
    }
    groups.set(key, g);
  }

  const rows: AttributionReportRow[] = Array.from(groups.entries())
    .map(([campaignId, g]) => ({
      campaignId,
      label: g.label,
      leads: g.leads,
      qualified: g.qualified,
      qualificationRate: g.leads ? g.qualified / g.leads : 0,
      won: g.won,
      bookingValue: g.bookingValue,
      avgBookingValue: g.won ? g.bookingValue / g.won : 0,
    }))
    .sort((a, b) => b.bookingValue - a.bookingValue || b.leads - a.leads);

  const t = rows.reduce(
    (acc, r) => {
      acc.leads += r.leads;
      acc.qualified += r.qualified;
      acc.won += r.won;
      acc.bookingValue += r.bookingValue;
      return acc;
    },
    { leads: 0, qualified: 0, won: 0, bookingValue: 0 }
  );

  const totals: AttributionReportRow = {
    campaignId: "__total__",
    label: "All campaigns",
    leads: t.leads,
    qualified: t.qualified,
    qualificationRate: t.leads ? t.qualified / t.leads : 0,
    won: t.won,
    bookingValue: t.bookingValue,
    avgBookingValue: t.won ? t.bookingValue / t.won : 0,
  };

  return { success: true as const, rows, totals };
}
