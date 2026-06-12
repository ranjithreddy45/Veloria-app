import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AvailabilityBoard } from "./_components/availability-board";

export const metadata: Metadata = { title: "Slot Availability" };

export default function AvailabilityPage() {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Slot Availability"
        description="See exactly which slots are free across every venue. Pick a day for the venue × slot grid, or scan the month heatmap and click any day to inspect it."
      />
      <AvailabilityBoard initialDate={today} />
    </div>
  );
}
