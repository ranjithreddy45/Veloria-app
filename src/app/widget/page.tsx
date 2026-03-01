import { prisma } from "@/lib/prisma";
import { WidgetInquiryForm } from "@/components/widget/widget-inquiry-form";

// ============================================================
// Widget Page — Standalone Embeddable Booking Form
// ============================================================

export default async function WidgetPage() {
  // Fetch active venues for the form (no auth required)
  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      capacity: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <WidgetInquiryForm venues={venues} />
    </div>
  );
}
