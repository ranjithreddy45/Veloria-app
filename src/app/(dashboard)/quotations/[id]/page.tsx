import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSalesQuotation } from "@/actions/sales-quotation.actions";
import { QuotationDetail } from "../_components/quotation-detail";

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

  return (
    <div className="space-y-6">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <QuotationDetail quote={res.data as any} perms={perms} leads={leads} venues={venues} />
    </div>
  );
}
