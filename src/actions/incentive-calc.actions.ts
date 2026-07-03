"use server";

// ============================================================
// Auto-incentive calculator — turn a period's sales performance (revenue,
// upsell, bookings) into suggested incentive amounts using a MANAGER-CONFIGURED
// rule, then create them as pending PerformanceIncentive rows for review/award.
// The formula lives in the UI (manager sets the numbers) so nothing is hardcoded.
// ============================================================

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-logger";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireManager() {
  const session = await auth();
  const u = session?.user as { id: string; role?: string } | undefined;
  if (!u?.id) return null;
  return hasPermission(u.role ?? "", "performance:manage") ? u : null;
}

const num = (x: unknown) => Number(x ?? 0) || 0;
const IST = 5.5 * 3600 * 1000;

// "YYYY-MM" → absolute UTC [start,end] of that IST month.
function monthBounds(period: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]) - 1;
  const start = new Date(Date.UTC(y, mo, 1) - IST);
  const end = new Date(Date.UTC(mo === 11 ? y + 1 : y, (mo + 1) % 12, 1) - IST - 1);
  return { start, end };
}

export interface IncentiveRule {
  period: string; // YYYY-MM
  upsellPct: number; // % of upsell value paid as incentive
  perBookingBonus: number; // ₹ per confirmed booking
  revenueThreshold: number; // ₹ — revenue above this earns...
  revenuePct: number; // ...this % of the excess
}

export interface IncentiveSuggestion {
  userId: string;
  name: string;
  bookings: number;
  revenue: number;
  upsell: number;
  bonus: number;
  breakdown: string;
}

// ------------------------------------------------------------
// Compute suggestions (no writes)
// ------------------------------------------------------------
export async function computeIncentiveSuggestions(rule: IncentiveRule): Promise<Result<IncentiveSuggestion[]>> {
  const user = await requireManager();
  if (!user) return { success: false, error: "Only managers can calculate incentives." };
  const bounds = monthBounds(rule.period);
  if (!bounds) return { success: false, error: "Pick a valid month." };

  const bookings = await prisma.booking.findMany({
    where: { status: "CONFIRMED", createdAt: { gte: bounds.start, lte: bounds.end } },
    select: { createdById: true, totalAmount: true, decorCharges: true, otherServices: true },
  });

  const agg = new Map<string, { bookings: number; revenue: number; upsell: number }>();
  for (const b of bookings) {
    if (!b.createdById) continue;
    const r = agg.get(b.createdById) ?? { bookings: 0, revenue: 0, upsell: 0 };
    r.bookings++;
    r.revenue += num(b.totalAmount);
    r.upsell += num(b.decorCharges) + num(b.otherServices);
    agg.set(b.createdById, r);
  }

  const ids = [...agg.keys()];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name ?? "Unnamed"]));

  const upsellPct = Math.max(0, rule.upsellPct) / 100;
  const revenuePct = Math.max(0, rule.revenuePct) / 100;
  const perBooking = Math.max(0, rule.perBookingBonus);
  const threshold = Math.max(0, rule.revenueThreshold);

  const suggestions: IncentiveSuggestion[] = [...agg.entries()].map(([userId, r]) => {
    const upsellPart = Math.round(r.upsell * upsellPct);
    const bookingPart = Math.round(r.bookings * perBooking);
    const revenuePart = Math.round(Math.max(0, r.revenue - threshold) * revenuePct);
    const bonus = upsellPart + bookingPart + revenuePart;
    return {
      userId, name: nameMap.get(userId) ?? "Unknown",
      bookings: r.bookings, revenue: Math.round(r.revenue), upsell: Math.round(r.upsell), bonus,
      breakdown: `₹${upsellPart.toLocaleString("en-IN")} upsell + ₹${bookingPart.toLocaleString("en-IN")} bookings + ₹${revenuePart.toLocaleString("en-IN")} revenue`,
    };
  }).filter((s) => s.bonus > 0).sort((a, b) => b.bonus - a.bonus);

  return { success: true, data: suggestions };
}

// ------------------------------------------------------------
// Create pending incentives from selected suggestions
// ------------------------------------------------------------
export async function createComputedIncentives(input: { period: string; items: { userId: string; bonusAmount: number }[] }): Promise<Result<{ created: number }>> {
  const user = await requireManager();
  if (!user) return { success: false, error: "Only managers can create incentives." };
  const items = (input.items || []).filter((i) => i.userId && i.bonusAmount > 0);
  if (!items.length) return { success: false, error: "Nothing selected." };

  await prisma.performanceIncentive.createMany({
    data: items.map((i) => ({
      title: `Sales incentive — ${input.period}`,
      period: input.period,
      bonusAmount: i.bonusAmount,
      userId: i.userId,
      isAwarded: false,
    })),
  });

  await logActivity({ userId: user.id, action: "incentives_computed", entityType: "PerformanceIncentive", entityId: input.period }).catch(() => {});
  revalidatePath("/performance/incentives");
  return { success: true, data: { created: items.length } };
}
