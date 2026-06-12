import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { StatusPill } from "@/components/shared/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SLOT_LABEL, type TimeSlotEnum } from "@/lib/sales/slot";

export const metadata: Metadata = { title: "Slot Availability" };

const STATUS_HUE: Record<string, "amber" | "emerald" | "blue" | "slate" | "rose"> = {
  HOLD: "amber",
  TENTATIVE: "amber",
  CONFIRMED: "emerald",
  IN_PROGRESS: "blue",
  COMPLETED: "slate",
};

export default async function AvailabilityPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 90);

  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      bookings: {
        where: { date: { gte: today, lte: horizon }, status: { not: "CANCELLED" } },
        select: { id: true, bookingNumber: true, eventName: true, date: true, timeSlot: true, status: true },
        orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
      },
      blackoutDates: {
        where: { date: { gte: today, lte: horizon } },
        select: { id: true, date: true, timeSlot: true, reason: true },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Slot Availability"
        description="Blocked and held slots per property for the next 90 days. A held (HOLD) slot is reserved pending the booking advance; CONFIRMED slots are paid and locked."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {venues.map((v) => {
          const rows = [
            ...v.bookings.map((b) => ({
              key: b.id,
              date: b.date as unknown as Date,
              slot: b.timeSlot as TimeSlotEnum,
              label: `${b.bookingNumber} · ${b.eventName}`,
              status: b.status as string,
            })),
            ...v.blackoutDates.map((b) => ({
              key: b.id,
              date: b.date as unknown as Date,
              slot: (b.timeSlot ?? "FULL_DAY") as TimeSlotEnum,
              label: `Blackout — ${b.reason || "unavailable"}`,
              status: "BLACKOUT",
            })),
          ].sort((a, z) => new Date(a.date).getTime() - new Date(z.date).getTime());

          return (
            <Card key={v.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{v.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {rows.length} blocked
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All slots free for the next 90 days.</p>
                ) : (
                  <div className="space-y-1.5">
                    {rows.map((r) => (
                      <div key={r.key} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{fmt(r.date)}</span>
                          <span className="w-28 shrink-0 text-xs">{SLOT_LABEL[r.slot]}</span>
                          <span className="truncate">{r.label}</span>
                        </div>
                        <StatusPill
                          label={r.status === "BLACKOUT" ? "Blackout" : r.status}
                          hue={r.status === "BLACKOUT" ? "rose" : STATUS_HUE[r.status] ?? "slate"}
                          size="xs"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
