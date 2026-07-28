import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLead } from "@/actions/lead.actions";
import { PencilIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LeadForm } from "../../_components/lead-form";

export const metadata: Metadata = { title: "Edit Lead" };

// ============================================================
// Edit Lead Page
// ============================================================

interface EditLeadPageProps {
  params: Promise<{ leadId: string }>;
}

export default async function EditLeadPage({ params }: EditLeadPageProps) {
  const { leadId } = await params;

  const [leadResult, contacts, venues, users] = await Promise.all([
    getLead(leadId),
    prisma.contact.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
      orderBy: { firstName: "asc" },
    }),
    prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ["SALES_EXEC", "SALES_HEAD", "EVENT_COORDINATOR", "ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!leadResult.success || !leadResult.data) {
    notFound();
  }

  const lead = leadResult.data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PencilIcon}
        accent="blue"
        eyebrow="CRM · Lead"
        title="Edit Lead"
        description={`Editing "${lead.title}"`}
      />
      <div className="mx-auto max-w-3xl">
        <LeadForm
          contacts={contacts}
          venues={venues}
          users={users}
          lead={{
            id: lead.id,
            title: lead.title,
            contactId: lead.contact.id,
            source: lead.source,
            eventType: lead.eventType,
            eventDate: lead.eventDate,
            guestCount: lead.guestCount,
            estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
            preferredVenueId: lead.preferredVenueId ?? null,
            assignedToId: lead.assignedToId ?? null,
            slot: lead.slot ?? null,
            vegNonVeg: lead.vegNonVeg ?? null,
            perPlateBudget: lead.perPlateBudget ? Number(lead.perPlateBudget) : null,
            description: lead.description,
            images: lead.images ?? [],
          }}
        />
      </div>
    </div>
  );
}
