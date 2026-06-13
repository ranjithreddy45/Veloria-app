"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { acqHasAnyAccess } from "@/lib/acq/rbac";

// ============================================================
// Global Search Types
// ============================================================

export type SearchResult = {
  id: string;
  type:
    | "contact" | "lead" | "booking" | "invoice" | "task" | "quote" | "contract" | "vendor" | "package"
    | "bd_lead" | "bd_deal" | "bd_property" | "bd_owner";
  title: string;
  subtitle: string;
  href: string;
};

// ============================================================
// Global Search Action
// ============================================================

export async function globalSearch(
  query: string
): Promise<{ success: boolean; data: SearchResult[]; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false, data: [], error: "Unauthorized" };
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return { success: true, data: [] };
    }

    // BD records are only surfaced to users with acquisition access (the /bd/* and
    // /owners/* routes are role-gated, so search must respect the same boundary).
    const role = (session.user as { role?: string }).role ?? "";
    const canBd = acqHasAnyAccess(role);

    const [contacts, leads, bookings, invoices, tasks, quotes, contracts, vendors, packages] = await Promise.all([
      // Contacts — search by name, email, phone, company
      prisma.contact.findMany({
        where: {
          OR: [
            { firstName: { contains: trimmed, mode: "insensitive" } },
            { lastName: { contains: trimmed, mode: "insensitive" } },
            { email: { contains: trimmed, mode: "insensitive" } },
            { phone: { contains: trimmed, mode: "insensitive" } },
            { company: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, email: true, company: true },
        take: 5,
        orderBy: { firstName: "asc" },
      }),

      // Leads — search by title
      prisma.lead.findMany({
        where: {
          OR: [
            { title: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          contact: { select: { firstName: true, lastName: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      // Bookings — search by booking number, event name
      prisma.booking.findMany({
        where: {
          OR: [
            { bookingNumber: { contains: trimmed, mode: "insensitive" } },
            { eventName: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          bookingNumber: true,
          eventName: true,
          venue: { select: { name: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      // Invoices — search by invoice number
      prisma.invoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          contact: { select: { firstName: true, lastName: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      // Tasks — search by title
      prisma.task.findMany({
        where: {
          OR: [
            { title: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      // Quotes — search by quote number, title
      prisma.quote.findMany({
        where: {
          OR: [
            { quoteNumber: { contains: trimmed, mode: "insensitive" } },
            { title: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          quoteNumber: true,
          title: true,
          status: true,
          contact: { select: { firstName: true, lastName: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      // Contracts — search by title
      prisma.contract.findMany({
        where: {
          OR: [
            { title: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          contact: { select: { firstName: true, lastName: true } },
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),

      // Vendors — search by name, company, email
      prisma.vendor.findMany({
        where: {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
            { company: { contains: trimmed, mode: "insensitive" } },
            { email: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          category: true,
          company: true,
        },
        take: 5,
        orderBy: { name: "asc" },
      }),

      // Packages — search by name
      prisma.eventPackage.findMany({
        where: {
          OR: [
            { name: { contains: trimmed, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          tier: true,
          eventType: true,
        },
        take: 5,
        orderBy: { name: "asc" },
      }),
    ]);

    // ---- BD records (acquisition) — only for users with BD access ----
    const [bdLeads, bdDeals, bdProps, bdOwners] = canBd
      ? await Promise.all([
          prisma.acqLead.findMany({
            where: {
              deletedAt: null,
              OR: [
                { propertyName: { contains: trimmed, mode: "insensitive" } },
                { ownerName: { contains: trimmed, mode: "insensitive" } },
                { city: { contains: trimmed, mode: "insensitive" } },
                { mobilePrimary: { contains: trimmed, mode: "insensitive" } },
              ],
            },
            select: { id: true, propertyName: true, ownerName: true, city: true, status: true },
            take: 5,
            orderBy: { createdAt: "desc" },
          }),
          prisma.acqDeal.findMany({
            where: {
              deletedAt: null,
              OR: [
                { name: { contains: trimmed, mode: "insensitive" } },
                { propertyName: { contains: trimmed, mode: "insensitive" } },
                { ownerName: { contains: trimmed, mode: "insensitive" } },
                { city: { contains: trimmed, mode: "insensitive" } },
              ],
            },
            select: { id: true, name: true, propertyName: true, city: true, stage: true },
            take: 5,
            orderBy: { updatedAt: "desc" },
          }),
          prisma.acqProperty.findMany({
            where: {
              deletedAt: null,
              OR: [
                { propertyName: { contains: trimmed, mode: "insensitive" } },
                { ownerName: { contains: trimmed, mode: "insensitive" } },
                { city: { contains: trimmed, mode: "insensitive" } },
                { address: { contains: trimmed, mode: "insensitive" } },
              ],
            },
            select: { id: true, propertyName: true, ownerName: true, city: true, status: true },
            take: 5,
            orderBy: { createdAt: "desc" },
          }),
          prisma.hallOwner.findMany({
            where: {
              OR: [
                { ownerName: { contains: trimmed, mode: "insensitive" } },
                { companyName: { contains: trimmed, mode: "insensitive" } },
                { email: { contains: trimmed, mode: "insensitive" } },
                { phone: { contains: trimmed, mode: "insensitive" } },
                { propertyCity: { contains: trimmed, mode: "insensitive" } },
              ],
            },
            select: { id: true, ownerName: true, companyName: true, propertyCity: true, contractStatus: true },
            take: 5,
            orderBy: { ownerName: "asc" },
          }),
        ])
      : [[], [], [], []];

    const results: SearchResult[] = [
      ...contacts.map((c) => ({
        id: c.id,
        type: "contact" as const,
        title: `${c.firstName} ${c.lastName}`,
        subtitle: c.email ?? c.company ?? "Contact",
        href: `/contacts/${c.id}`,
      })),
      ...leads.map((l) => ({
        id: l.id,
        type: "lead" as const,
        title: l.title,
        subtitle: `${l.contact.firstName} ${l.contact.lastName} · ${l.status}`,
        href: `/leads/${l.id}`,
      })),
      ...bookings.map((b) => ({
        id: b.id,
        type: "booking" as const,
        title: b.eventName,
        subtitle: `${b.bookingNumber} · ${b.venue.name}`,
        href: `/bookings/${b.id}`,
      })),
      ...invoices.map((i) => ({
        id: i.id,
        type: "invoice" as const,
        title: i.invoiceNumber,
        subtitle: `${i.contact.firstName} ${i.contact.lastName} · ${i.status}`,
        href: `/invoices/${i.id}`,
      })),
      ...tasks.map((t) => ({
        id: t.id,
        type: "task" as const,
        title: t.title,
        subtitle: `${t.priority} · ${t.status}`,
        href: `/tasks/${t.id}`,
      })),
      ...quotes.map((q) => ({
        id: q.id,
        type: "quote" as const,
        title: `${q.quoteNumber} — ${q.title}`,
        subtitle: `${q.contact.firstName} ${q.contact.lastName} · ${q.status}`,
        href: `/quotes/${q.id}`,
      })),
      ...contracts.map((c) => ({
        id: c.id,
        type: "contract" as const,
        title: c.title,
        subtitle: `${c.contact.firstName} ${c.contact.lastName} · ${c.status}`,
        href: `/contracts/${c.id}`,
      })),
      ...vendors.map((v) => ({
        id: v.id,
        type: "vendor" as const,
        title: v.name,
        subtitle: `${v.category}${v.company ? ` · ${v.company}` : ""}`,
        href: `/vendors/${v.id}`,
      })),
      ...packages.map((p) => ({
        id: p.id,
        type: "package" as const,
        title: p.name,
        subtitle: `${p.tier}${p.eventType ? ` · ${p.eventType}` : ""}`,
        href: `/packages/${p.id}`,
      })),
      ...bdLeads.map((l) => ({
        id: l.id,
        type: "bd_lead" as const,
        title: l.propertyName,
        subtitle: `${l.ownerName} · ${l.city} · ${l.status}`,
        href: `/bd/leads/${l.id}`,
      })),
      ...bdDeals.map((d) => ({
        id: d.id,
        type: "bd_deal" as const,
        title: d.name,
        subtitle: `${d.propertyName} · ${d.city} · ${d.stage}`,
        href: `/bd/deals/${d.id}`,
      })),
      ...bdProps.map((p) => ({
        id: p.id,
        type: "bd_property" as const,
        title: p.propertyName,
        subtitle: `${p.ownerName} · ${p.city} · ${p.status}`,
        href: `/bd/properties/${p.id}`,
      })),
      ...bdOwners.map((o) => ({
        id: o.id,
        type: "bd_owner" as const,
        title: o.ownerName,
        subtitle: `${o.companyName ?? o.propertyCity ?? "Owner"} · ${o.contractStatus}`,
        href: `/owners/${o.id}/edit`,
      })),
    ];

    return { success: true, data: results };
  } catch (error) {
    console.error("[GLOBAL_SEARCH_ERROR]", error);
    return { success: false, data: [], error: "Search failed" };
  }
}
