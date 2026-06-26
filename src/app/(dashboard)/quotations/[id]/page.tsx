import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSalesQuotation } from "@/actions/sales-quotation.actions";
import { getQuoteShareLink } from "@/actions/quote-share.actions";
import { QuotationDetail } from "../_components/quotation-detail";
import { QuoteRadarPanel } from "../_components/quote-radar-panel";

export const metadata: Metadata = { title: "Quotation" };

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [res, session] = await Promise.all([getSalesQuotation(id), auth()]);
  if (!res.success || !res.data) notFound();

  const role = session?.user?.role ?? "";
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const perms = {
    canApprove: isAdmin || hasPermission(role, "quotes:approve"),
    canSend: isAdmin || hasPermission(role, "quotes:send"),
    canCreate: isAdmin || hasPermission(role, "quotes:create"),
    canEdit: isAdmin || hasPermission(role, "quotes:update"),
  };

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

  // Proforma-first flow: slot booking is gated until the 20% advance is paid
  // on the quotation's invoice.
  const quoteInvoiceId = (res.data as { invoiceId?: string | null }).invoiceId;
  let advancePaid = false;
  if (quoteInvoiceId && quoteInvoiceId !== "__pending__") {
    const inv = await prisma.invoice.findUnique({
      where: { id: quoteInvoiceId },
      select: { paidAmount: true, totalAmount: true },
    });
    if (inv) advancePaid = Number(inv.paidAmount) >= Number(inv.totalAmount) * 0.2 - 1;
  }

  // Quote radar: existing share-link signals (best-effort — never block render).
  const radarRes = await getQuoteShareLink(id).catch(() => null);
  const radarSignals = radarRes && radarRes.success ? radarRes.data : null;
  const canShare = isAdmin || hasPermission(role, "quotes:send") || hasPermission(role, "publicquotes:manage");

  return (
    <div className="space-y-6">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <QuotationDetail quote={res.data as any} perms={perms} leads={leads} venues={venues} advancePaid={advancePaid} />
      <QuoteRadarPanel quotationId={id} initial={radarSignals} canShare={canShare} />
    </div>
  );
}
