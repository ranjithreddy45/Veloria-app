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

  // Optional prefill from ?leadId= (e.g. "Create quotation" on a lead). The
  // empty `id` keeps this a CREATE flow — only the customer meta is prefilled.
  const pre = leadId ? leads.find((l) => l.id === leadId) : undefined;
  const initial = pre
    ? {
        id: "",
        input: { guestCount: 0 },
        meta: {
          leadId: pre.id,
          contactId: pre.contactId,
          clientName: pre.clientName ?? undefined,
          clientPhone: pre.clientPhone ?? undefined,
          clientEmail: pre.clientEmail ?? undefined,
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
