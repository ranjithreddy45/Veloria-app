import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { FileTextIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { QuotationCalculator } from "../_components/quotation-calculator";

export const metadata: Metadata = { title: "New Quotation" };

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;

  // Field shape shared by the dropdown list and the single-lead lookup below.
  const leadSelect = {
    id: true,
    title: true,
    contactId: true,
    eventType: true,
    eventDate: true,
    guestCount: true,
    slot: true,
    preferredVenueId: true,
    contact: { select: { firstName: true, lastName: true, phone: true, email: true } },
  } as const;

  const [leadsRaw, venues, targetLead] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, status: { notIn: ["WON", "LOST"] } },
      select: leadSelect,
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Always resolve the lead we were sent from, even if it falls outside the
    // 300-row / non-WON-LOST window above. Without this, quoting from an older
    // or already-closed lead silently dropped the link and the quotation saved
    // unassigned — the dropdown never held the lead, so it couldn't prefill.
    leadId
      ? prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: leadSelect })
      : Promise.resolve(null),
  ]);

  // Merge the target lead into the option list if the window missed it, so the
  // "Link to Lead" picker can display it as the selected value.
  const leadsForOptions =
    targetLead && !leadsRaw.some((l) => l.id === targetLead.id)
      ? [targetLead, ...leadsRaw]
      : leadsRaw;

  const leads = leadsForOptions.map((l) => ({
    id: l.id,
    title: l.title,
    contactId: l.contactId,
    clientName: [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(" ") || null,
    clientPhone: l.contact?.phone ?? null,
    clientEmail: l.contact?.email ?? null,
  }));

  // The lead stores its slot as "Lunch"/"Dinner"; the quotation time-slot picker
  // uses "11am to 3pm"/"5pm to 10pm"/"Full Day". Map so the prefill actually
  // lands on a valid option (otherwise the dropdown silently shows blank).
  const mapSlotToTimeSlot = (slot?: string | null): string | undefined => {
    if (!slot) return undefined;
    const s = slot.toLowerCase();
    if (s.includes("lunch")) return "11am to 3pm";
    if (s.includes("dinner")) return "5pm to 10pm";
    if (s.includes("full")) return "Full Day";
    return slot; // already a valid value
  };

  // Optional prefill from ?leadId= ("Create Quotation" on a lead). The empty
  // `id` keeps this a CREATE flow. We carry over everything the team already
  // collected on the lead — customer, event details and guest count — so the
  // rep only has to pick packages and pricing.
  const preRaw = targetLead ?? undefined;
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
          timeSlot: mapSlotToTimeSlot(preRaw.slot),
        },
      }
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileTextIcon}
        accent="blue"
        eyebrow="Sales · Pricing"
        title="New Quotation"
        description="Build an event quotation with the calculator, then submit it for approval."
      />
      <QuotationCalculator leads={leads} venues={venues} initial={initial} />
    </div>
  );
}
