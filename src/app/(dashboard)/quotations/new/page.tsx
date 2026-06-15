import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { QuotationCalculator } from "../_components/quotation-calculator";

export const metadata: Metadata = { title: "New Quotation" };

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;

  const [leadsRaw, venues] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, status: { notIn: ["WON", "LOST"] } },
      select: {
        id: true,
        title: true,
        contactId: true,
        eventType: true,
        eventDate: true,
        guestCount: true,
        slot: true,
        preferredVenueId: true,
        contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const leads = leadsRaw.map((l) => ({
    id: l.id,
    title: l.title,
    contactId: l.contactId,
    clientName: [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(" ") || null,
    clientPhone: l.contact?.phone ?? null,
    clientEmail: l.contact?.email ?? null,
  }));

  // Optional prefill from ?leadId= ("Create Quotation" on a lead). The empty
  // `id` keeps this a CREATE flow. We carry over everything the team already
  // collected on the lead — customer, event details and guest count — so the
  // rep only has to pick packages and pricing.
  const preRaw = leadId ? leadsRaw.find((l) => l.id === leadId) : undefined;
  const initial = preRaw
    ? {
        id: "",
        input: { guestCount: preRaw.guestCount ?? 0 },
        meta: {
          leadId: preRaw.id,
          contactId: preRaw.contactId,
          venueId: preRaw.preferredVenueId ?? null,
          clientName:
            [preRaw.contact?.firstName, preRaw.contact?.lastName].filter(Boolean).join(" ") ||
            undefined,
          clientPhone: preRaw.contact?.phone ?? undefined,
          clientEmail: preRaw.contact?.email ?? undefined,
          occasion: preRaw.eventType ?? undefined,
          eventDate: preRaw.eventDate ? preRaw.eventDate.toISOString() : null,
          timeSlot: preRaw.slot ?? undefined,
        },
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="New Quotation" description="Build an event quotation with the calculator." />
      <QuotationCalculator leads={leads} venues={venues} initial={initial} />
    </div>
  );
}
