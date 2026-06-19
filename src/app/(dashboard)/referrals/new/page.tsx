import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ReferralForm } from "../_components/referral-form";

export const metadata: Metadata = { title: "New Referral" };

// ============================================================
// Create Referral Page
// ============================================================

export default async function NewReferralPage() {
  // Fetch contacts for the referrer selector
  const contacts = await prisma.contact.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
    orderBy: { firstName: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Referral"
        description="Record a new client referral."
      />
      <div className="mx-auto max-w-3xl">
        <ReferralForm contacts={contacts} />
      </div>
    </div>
  );
}
