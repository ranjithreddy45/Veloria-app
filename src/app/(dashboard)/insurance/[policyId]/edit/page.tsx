import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { getInsurancePolicyById } from "@/actions/insurance.actions";
import { PageHeader } from "@/components/layout/page-header";
import { InsurancePolicyForm } from "../../_components/insurance-policy-form";

export const metadata: Metadata = { title: "Edit Insurance Policy" };

// ============================================================
// Edit Insurance Policy Page
// ============================================================

interface EditInsurancePolicyPageProps {
  params: Promise<{ policyId: string }>;
}

export default async function EditInsurancePolicyPage({
  params,
}: EditInsurancePolicyPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const { policyId } = await params;
  const result = await getInsurancePolicyById(policyId);

  if (!result.success || !result.data) {
    notFound();
  }

  const policy = result.data;

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
        title="Edit Insurance Policy"
        description={`Editing policy ${policy.policyNumber}`}
      />
      <div className="mx-auto max-w-3xl">
        <InsurancePolicyForm
          policy={policy}
          bookings={serialize(bookings)}
          venues={serialize(venues)}
        />
      </div>
    </div>
  );
}
