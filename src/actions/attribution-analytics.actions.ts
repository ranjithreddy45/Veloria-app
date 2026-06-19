"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import type {
  AttributionBucket,
  AttributionRangeParams,
} from "@/schemas/attribution.schema";

// ============================================================
// Attribution Analytics — read-only rollups for the /marketing cockpit.
// ------------------------------------------------------------
// Groups LeadAttribution (joined to Lead -> Deal -> Booking and the lead's
// Contact) by channel and by campaign, computing per bucket:
//   leadCount, wonCount, winRate, bookedRevenue, spend, CAC, ROAS, avgLtv.
//
// Money: summed in Decimal, only converted to Number at the boundary, so no
// float drift. Divide-by-zero guarded — CAC/ROAS return null (rendered "—")
// when spend or won is 0. winRate = WON leads / total leads in the bucket
// (matches the existing funnel semantics).
//
// Gated by analytics:read (the cockpit RBAC) OR marketing:read.
// ============================================================

const D0 = () => new Prisma.Decimal(0);

type RangeParams = AttributionRangeParams;

function canRead(role: string): boolean {
  return (
    hasPermission(role, "analytics:read") || hasPermission(role, "marketing:read")
  );
}

function rangeWhere(params?: RangeParams): Prisma.LeadAttributionWhereInput {
  const where: Prisma.LeadAttributionWhereInput = {};
  const createdAt: Prisma.DateTimeFilter = {};
  if (params?.from) {
    const d = new Date(params.from);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (params?.to) {
    const d = new Date(params.to);
    if (!Number.isNaN(d.getTime())) {
      // inclusive end-of-day
      d.setHours(23, 59, 59, 999);
      createdAt.lte = d;
    }
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
  return where;
}

// Shared loader: pulls attributions with the closed-loop fields we need.
async function loadAttributions(params?: RangeParams) {
  return prisma.leadAttribution.findMany({
    where: rangeWhere(params),
    select: {
      id: true,
      source: true,
      utmSource: true,
      bookedRevenue: true,
      campaignId: true,
      campaignRef: {
        select: { id: true, name: true, channel: true, spendToDate: true },
      },
      lead: {
        select: {
          status: true,
          source: true,
          contact: { select: { totalRevenue: true } },
        },
      },
    },
  });
}

type LoadedAttribution = Awaited<ReturnType<typeof loadAttributions>>[number];

interface Accumulator {
  label: string;
  leadCount: number;
  wonCount: number;
  bookedRevenue: Prisma.Decimal;
  ltvSum: Prisma.Decimal;
  ltvCount: number;
}

function newAcc(label: string): Accumulator {
  return {
    label,
    leadCount: 0,
    wonCount: 0,
    bookedRevenue: D0(),
    ltvSum: D0(),
    ltvCount: 0,
  };
}

function accumulate(acc: Accumulator, a: LoadedAttribution): void {
  acc.leadCount += 1;
  const isWon = a.lead?.status === "WON";
  if (isWon) {
    acc.wonCount += 1;
    if (a.bookedRevenue) {
      acc.bookedRevenue = acc.bookedRevenue.add(a.bookedRevenue);
    }
    const ltv = a.lead?.contact?.totalRevenue;
    if (ltv) {
      acc.ltvSum = acc.ltvSum.add(ltv);
      acc.ltvCount += 1;
    }
  }
}

function finalize(
  key: string,
  acc: Accumulator,
  spend: Prisma.Decimal
): AttributionBucket {
  const spendNum = spend.toNumber();
  const bookedNum = acc.bookedRevenue.toNumber();
  const cac = acc.wonCount > 0 && spendNum > 0 ? spendNum / acc.wonCount : null;
  const roas = spendNum > 0 ? bookedNum / spendNum : null;
  const avgLtv =
    acc.ltvCount > 0 ? acc.ltvSum.toNumber() / acc.ltvCount : null;
  return {
    key,
    label: acc.label,
    leadCount: acc.leadCount,
    wonCount: acc.wonCount,
    winRate: acc.leadCount > 0 ? acc.wonCount / acc.leadCount : 0,
    bookedRevenue: bookedNum,
    spend: spendNum,
    cac: cac !== null ? Number(cac.toFixed(2)) : null,
    roas: roas !== null ? Number(roas.toFixed(2)) : null,
    avgLtv: avgLtv !== null ? Number(avgLtv.toFixed(2)) : null,
  };
}

// Best-available channel label for a row that has no linked campaign.
function channelOf(a: LoadedAttribution): string {
  return (
    a.campaignRef?.channel ||
    a.source ||
    a.lead?.source ||
    a.utmSource ||
    "Direct / Unknown"
  );
}

// ------------------------------------------------------------
// Per-channel rollup
// ------------------------------------------------------------

export async function getChannelAttribution(params?: RangeParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!canRead(session.user.role as string)) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [attributions, campaigns] = await Promise.all([
      loadAttributions(params),
      prisma.marketingCampaign.findMany({
        select: { channel: true, spendToDate: true },
      }),
    ]);

    // Spend per channel = sum of its campaigns' spendToDate.
    const spendByChannel = new Map<string, Prisma.Decimal>();
    for (const c of campaigns) {
      const key = c.channel || "Direct / Unknown";
      const prev = spendByChannel.get(key) ?? D0();
      spendByChannel.set(key, prev.add(c.spendToDate));
    }

    const accs = new Map<string, Accumulator>();
    for (const a of attributions) {
      const key = channelOf(a);
      let acc = accs.get(key);
      if (!acc) {
        acc = newAcc(key);
        accs.set(key, acc);
      }
      accumulate(acc, a);
    }

    // Ensure channels that have spend but no leads still surface.
    for (const [channel] of spendByChannel) {
      if (!accs.has(channel)) accs.set(channel, newAcc(channel));
    }

    const buckets: AttributionBucket[] = [];
    for (const [key, acc] of accs) {
      buckets.push(finalize(key, acc, spendByChannel.get(key) ?? D0()));
    }
    buckets.sort((a, b) => b.bookedRevenue - a.bookedRevenue);

    return { success: true as const, data: buckets };
  } catch (error) {
    console.error("[GET_CHANNEL_ATTRIBUTION_ERROR]", error);
    return { success: false as const, error: "Failed to compute channel attribution" };
  }
}

// ------------------------------------------------------------
// Per-campaign rollup
// ------------------------------------------------------------

export async function getCampaignAttribution(params?: RangeParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }
    if (!canRead(session.user.role as string)) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const [attributions, campaigns] = await Promise.all([
      loadAttributions(params),
      prisma.marketingCampaign.findMany({
        select: { id: true, name: true, channel: true, spendToDate: true },
      }),
    ]);

    const spendById = new Map<string, Prisma.Decimal>();
    const labelById = new Map<string, string>();
    for (const c of campaigns) {
      spendById.set(c.id, c.spendToDate);
      labelById.set(c.id, `${c.name} · ${c.channel}`);
    }

    const accs = new Map<string, Accumulator>();
    for (const a of attributions) {
      if (!a.campaignId) continue; // only linked rows roll up per-campaign
      const key = a.campaignId;
      const label =
        labelById.get(key) ??
        (a.campaignRef ? `${a.campaignRef.name} · ${a.campaignRef.channel}` : key);
      let acc = accs.get(key);
      if (!acc) {
        acc = newAcc(label);
        accs.set(key, acc);
      }
      accumulate(acc, a);
    }

    // Surface campaigns with spend but zero attributed leads.
    for (const c of campaigns) {
      if (!accs.has(c.id)) {
        accs.set(c.id, newAcc(`${c.name} · ${c.channel}`));
      }
    }

    const buckets: AttributionBucket[] = [];
    for (const [key, acc] of accs) {
      buckets.push(finalize(key, acc, spendById.get(key) ?? D0()));
    }
    buckets.sort((a, b) => b.bookedRevenue - a.bookedRevenue);

    return { success: true as const, data: buckets };
  } catch (error) {
    console.error("[GET_CAMPAIGN_ATTRIBUTION_ERROR]", error);
    return { success: false as const, error: "Failed to compute campaign attribution" };
  }
}
