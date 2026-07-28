import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { UserPlus as UserPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LeadForm } from "../_components/lead-form";

export const metadata: Metadata = { title: "New Lead" };

// ============================================================
// Create Lead Page
// ============================================================

export default async function NewLeadPage() {
  // Fetch contacts for the contact selector
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

  const venues = await prisma.venue.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Internal sales-facing users a lead can be assigned to.
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserPlusIcon}
        accent="blue"
        eyebrow="CRM · Lead"
        title="New Lead"
        description="Capture a new enquiry — the event, the budget and who owns it."
      />
      <div className="mx-auto max-w-3xl">
        <LeadForm contacts={contacts} venues={venues} users={users} />
      </div>
    </div>
  );
}
