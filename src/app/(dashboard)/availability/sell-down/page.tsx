import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getSellDownBoard } from "@/actions/sell-down.actions";
import { SellDownBoard } from "./_components/sell-down-board";

export const metadata: Metadata = { title: "Sell-Down Board" };

// Internal, gated by the existing /availability ROUTE_PERMISSIONS prefix
// (bookings:read) + INTERNAL_ROUTES — no middleware edit needed.
export default async function SellDownPage() {
  const res = await getSellDownBoard();
  const initial = res.success ? res.data : null;

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        eyebrow="Sales · Capacity"
        title="Sell-Down Board"
        description="Upcoming low-occupancy venue slots paired with matching open leads to chase. Fill perishable peak-date inventory before it expires — reps act via the usual lead, quote and booking flows."
      />
      <SellDownBoard initial={initial} unauthorized={!res.success} />
    </div>
  );
}
