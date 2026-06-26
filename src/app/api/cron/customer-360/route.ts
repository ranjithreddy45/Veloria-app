import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

// ============================================================
// Customer-360 rollups (spec §3.2)
// ============================================================
// Recomputes per-contact lifetime metrics from their bookings:
//   lifetimeBookings, totalRevenue, lastEventDate, customerType.
// vipCustomer / anniversary are set manually by staff and respected here
// (a VIP stays "VIP"). Runs daily via /api/cron/daily.

const ACTIVE_STATUSES = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Aggregate bookings per contact in one grouped query.
    const grouped = await prisma.booking.groupBy({
      by: ["contactId"],
      where: { status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
      _sum: { totalAmount: true },
      _max: { date: true },
    });

    // Batch-fetch VIP flags for all grouped contacts in one query (avoids N+1).
    const contactIds = grouped
      .map((g) => g.contactId)
      .filter((id): id is string => id != null);
    const vipContacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      select: { id: true, vipCustomer: true },
    });
    const vipById = new Map(vipContacts.map((c) => [c.id, c.vipCustomer]));

    let updated = 0;
    for (const g of grouped) {
      const count = g._count._all;
      const revenue = g._sum.totalAmount ?? 0;
      const lastDate = g._max.date ?? null;

      // Use the pre-fetched VIP flag so we don't downgrade a manually-flagged VIP.
      const customerType = vipById.get(g.contactId)
        ? "VIP"
        : count > 1
          ? "Repeat"
          : "New";

      await prisma.contact.update({
        where: { id: g.contactId },
        data: {
          lifetimeBookings: count,
          totalRevenue: revenue,
          lastEventDate: lastDate,
          customerType,
        },
      });
      updated++;
    }

    return NextResponse.json({ success: true, contactsUpdated: updated });
  } catch (error) {
    console.error("[CUSTOMER_360_CRON_ERROR]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
