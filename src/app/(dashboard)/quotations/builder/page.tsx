import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getQuotePackages } from "@/actions/quote-catalog.actions";
import { getSalesQuotation } from "@/actions/sales-quotation.actions";
import type { CatalogStoredInput } from "@/lib/sales/quotation-calc";
import { QuotationBuilder, type BuilderInitial } from "./_components/quotation-builder";

export const metadata: Metadata = { title: "Build Quotation" };

export default async function QuotationBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; leadId?: string }>;
}) {
  const { id, leadId } = await searchParams;

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!hasPermission(role, "quotes:create")) redirect("/not-authorized");

  const [pkgRes, leadsRaw, venues] = await Promise.all([
    getQuotePackages({ activeOnly: true }),
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

  const packages = pkgRes.success ? pkgRes.data : [];

  const leads = leadsRaw.map((l) => ({
    id: l.id,
    title: l.title,
    contactId: l.contactId,
    clientName: [l.contact?.firstName, l.contact?.lastName].filter(Boolean).join(" ") || null,
    clientPhone: l.contact?.phone ?? null,
    clientEmail: l.contact?.email ?? null,
  }));

  // The lead stores its slot as "Lunch"/"Dinner"/"Full"; the builder time-slot
  // picker uses "11am to 3pm"/"5pm to 10pm"/"Full Day". Map so the prefill
  // actually lands on a valid option.
  const mapSlotToTimeSlot = (slot?: string | null): string | undefined => {
    if (!slot) return undefined;
    const s = slot.toLowerCase();
    if (s.includes("lunch")) return "11am to 3pm";
    if (s.includes("dinner")) return "5pm to 10pm";
    if (s.includes("full")) return "Full Day";
    return slot;
  };

  let initial: BuilderInitial | undefined;

  // ---- Edit flow: only a DRAFT catalog-mode quotation may be edited here. ----
  if (id) {
    const qRes = await getSalesQuotation(id);
    if (qRes.success) {
      const q = qRes.data as {
        id: string;
        status: string;
        inputsJson: unknown;
        clientName: string | null;
        clientPhone: string | null;
        clientEmail: string | null;
        occasion: string | null;
        eventDate: string | null;
        timeSlot: string | null;
        notes: string | null;
        leadId: string | null;
        contactId: string | null;
        venueId: string | null;
      };
      const stored = q.inputsJson as CatalogStoredInput | null;
      if (q.status !== "DRAFT" || stored?.mode !== "catalog") {
        redirect(`/quotations/${id}`);
      }
      initial = {
        id: q.id,
        stored,
        meta: {
          clientName: q.clientName ?? undefined,
          clientPhone: q.clientPhone ?? undefined,
          clientEmail: q.clientEmail ?? undefined,
          occasion: q.occasion ?? undefined,
          eventDate: q.eventDate ?? null,
          timeSlot: q.timeSlot ?? undefined,
          notes: q.notes ?? undefined,
          leadId: q.leadId ?? null,
          contactId: q.contactId ?? null,
          venueId: q.venueId ?? null,
        },
      };
    }
  }

  // ---- Create flow: optional prefill from ?leadId= ----
  if (!initial && leadId) {
    const pre = leadsRaw.find((l) => l.id === leadId);
    if (pre) {
      initial = {
        id: "",
        stored: {
          mode: "catalog",
          catalog: { guestCount: pre.guestCount ?? 0, selections: [] },
          packages: [],
        },
        meta: {
          leadId: pre.id,
          contactId: pre.contactId,
          venueId: pre.preferredVenueId ?? null,
          clientName:
            [pre.contact?.firstName, pre.contact?.lastName].filter(Boolean).join(" ") || undefined,
          clientPhone: pre.contact?.phone ?? undefined,
          clientEmail: pre.contact?.email ?? undefined,
          occasion: pre.eventType ?? undefined,
          eventDate: pre.eventDate ? pre.eventDate.toISOString() : null,
          timeSlot: mapSlotToTimeSlot(pre.slot),
        },
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Build Quotation"
        description="Pick packages from the catalog — pricing, menus and the customer quote update live."
      />
      <QuotationBuilder leads={leads} venues={venues} packages={packages} initial={initial} />
    </div>
  );
}
