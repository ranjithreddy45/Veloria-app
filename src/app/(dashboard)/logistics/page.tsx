import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getDispatches, getBookableEvents } from "@/actions/logistics.actions";
import { PageHeader } from "@/components/layout/page-header";
import { DispatchBoard } from "./_components/dispatch-board";

export const metadata: Metadata = { title: "Logistics & Dispatch" };

// ============================================================
// Logistics list page — equipment-dispatch board.
// Gated to logistics:read; writes flow through logistics:write.
// ============================================================
export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !hasPermission(role, "logistics:read")) redirect("/dashboard");

  const canWrite = hasPermission(role, "logistics:write");
  const { bookingId } = await searchParams;
  const [dispatchesRes, eventsRes] = await Promise.all([
    getDispatches(),
    canWrite
      ? getBookableEvents()
      : Promise.resolve<Awaited<ReturnType<typeof getBookableEvents>>>({ success: true, data: [] }),
  ]);

  const dispatches = dispatchesRes.success ? dispatchesRes.data : [];
  const events = eventsRes.success ? eventsRes.data : [];

  // "Create Dispatch" from a booking. getBookableEvents only lists CONFIRMED
  // bookings, so if we arrived for an in-progress/completed event, make sure it
  // still appears as a selectable option.
  let initialBookingId: string | null = null;
  if (canWrite && bookingId) {
    initialBookingId = bookingId;
    if (!events.some((e) => e.id === bookingId)) {
      const b = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, bookingNumber: true, eventName: true, date: true, venue: { select: { name: true } } },
      });
      if (b) {
        events.unshift({
          id: b.id,
          label: `${b.bookingNumber} · ${b.eventName}${b.venue?.name ? ` · ${b.venue.name}` : ""}`,
          date: b.date?.toISOString() ?? null,
        });
      } else {
        initialBookingId = null;
      }
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        title="Logistics & Dispatch"
        eyebrow={`Equipment dispatch · ${dispatches.length} orders`}
        description="Plan, dispatch, deliver and reconcile returns of equipment for your events."
      />
      <DispatchBoard
        dispatches={dispatches}
        events={events}
        canWrite={canWrite}
        initialBookingId={initialBookingId}
      />
    </div>
  );
}
