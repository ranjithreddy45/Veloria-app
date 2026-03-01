import type { Metadata } from "next";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { InsurancePolicyForm } from "../_components/insurance-policy-form";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "New Insurance Policy" };

// ============================================================
// Create Insurance Policy Page
// ============================================================

export default async function NewInsurancePolicyPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  // Fetch bookings and venues for the optional selects
  const [bookings, venues] = await Promise.all([
    prisma.booking.findMany({
      select: { id: true, bookingNumber: true, eventName: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.venue.findMany({
      select: { id: true, name: true },
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Insurance Policy"
        description="Create a new insurance policy for an event, booking, or venue."
      />
      <div className="mx-auto max-w-3xl">
        <InsurancePolicyForm
          bookings={serialize(bookings)}
          venues={serialize(venues)}
        />
      </div>
    </div>
  );
}
