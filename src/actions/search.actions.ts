"use server";

import type { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { acqHasAnyAccess } from "@/lib/acq/rbac";

// ============================================================
// Global Search Types
// ============================================================

export type SearchResult = {
  id: string;
  type:
    | "contact" | "lead" | "booking" | "invoice" | "task" | "quote" | "contract" | "vendor" | "package" | "campaign"
    | "bd_lead" | "bd_deal" | "bd_property" | "bd_owner";
  title: string;
  subtitle: string;
  href: string;
};

// ============================================================
// Query helpers — tokenized, multi-word AND matching
// ------------------------------------------------------------
// "john smith" must match a contact stored as firstName=John, lastName=Smith:
// every token has to hit at least ONE of the entity's searchable fields, but
// different tokens may hit different fields. This is what makes full names,
// "wedding hyderabad", or "john 98765" resolve.
// ============================================================

function tokenize(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 1)
    .slice(0, 6);
}

type Cond = Record<string, unknown>;

/**
 * Build a Prisma `where` that requires EVERY token to match at least one of the
 * given field conditions. `fieldsFor(token)` returns the OR-conditions for a
 * single token (plain or nested-relation conditions both allowed).
 */
function allTokens<T>(tokens: string[], fieldsFor: (tok: string) => Cond[]): T {
  return { AND: tokens.map((tok) => ({ OR: fieldsFor(tok) })) } as unknown as T;
}

const ci = (field: string, tok: string): Cond => ({
  [field]: { contains: tok, mode: "insensitive" },
});

// Relevance scoring: exact title > prefix > substring > all-tokens-in-title >
// tokens spread across title+subtitle. Higher is better.
function scoreOf(title: string, subtitle: string, q: string, tokens: string[]): number {
  const t = title.toLowerCase();
  const s = (subtitle ?? "").toLowerCase();
  const ql = q.trim().toLowerCase();
  if (t === ql) return 1000;
  if (t.startsWith(ql)) return 850;
  if (t.includes(ql)) return 700;
  if (tokens.every((tok) => t.includes(tok))) return 550;
  if (tokens.every((tok) => t.includes(tok) || s.includes(tok))) return 350;
  return 150;
}

const PER_TYPE = 6;
const GLOBAL_CAP = 28;

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
    const tokens = tokenize(trimmed);

    // BD records are only surfaced to users with acquisition access (the /bd/* and
    // /owners/* routes are role-gated, so search must respect the same boundary).
    const role = (session.user as { role?: string }).role ?? "";
    const canBd = acqHasAnyAccess(role);

    const [contacts, leads, bookings, invoices, tasks, quotes, contracts, vendors, packages, campaigns] =
      await Promise.all([
        // Contacts — name, email, phone, company
        prisma.contact.findMany({
          where: { deletedAt: null, ...allTokens<Prisma.ContactWhereInput>(tokens, (tok) => [
            ci("firstName", tok), ci("lastName", tok), ci("email", tok), ci("phone", tok), ci("company", tok),
          ]) },
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true },
          take: PER_TYPE,
          orderBy: { firstName: "asc" },
        }),

        // Leads — title, description, eventType + the linked contact's name/phone/email
        prisma.lead.findMany({
          where: { deletedAt: null, ...allTokens<Prisma.LeadWhereInput>(tokens, (tok) => [
            ci("title", tok), ci("description", tok), ci("eventType", tok),
            { contact: { OR: [ci("firstName", tok), ci("lastName", tok), ci("phone", tok), ci("email", tok)] } },
          ]) },
          select: {
            id: true, title: true, status: true,
            contact: { select: { firstName: true, lastName: true } },
          },
          take: PER_TYPE,
          orderBy: { createdAt: "desc" },
        }),

        // Bookings — number, event name/type + contact name + venue name
        prisma.booking.findMany({
          where: allTokens<Prisma.BookingWhereInput>(tokens, (tok) => [
            ci("bookingNumber", tok), ci("eventName", tok), ci("eventType", tok),
            { contact: { OR: [ci("firstName", tok), ci("lastName", tok), ci("phone", tok)] } },
            { venue: { name: { contains: tok, mode: "insensitive" } } },
          ]),
          select: {
            id: true, bookingNumber: true, eventName: true,
            venue: { select: { name: true } },
            contact: { select: { firstName: true, lastName: true } },
          },
          take: PER_TYPE,
          orderBy: { createdAt: "desc" },
        }),

        // Invoices — number + contact name
        prisma.invoice.findMany({
          where: allTokens<Prisma.InvoiceWhereInput>(tokens, (tok) => [
            ci("invoiceNumber", tok),
            { contact: { OR: [ci("firstName", tok), ci("lastName", tok), ci("phone", tok)] } },
          ]),
          select: {
            id: true, invoiceNumber: true, status: true,
            contact: { select: { firstName: true, lastName: true } },
          },
          take: PER_TYPE,
          orderBy: { createdAt: "desc" },
        }),

        // Tasks — title + description
        prisma.task.findMany({
          where: allTokens<Prisma.TaskWhereInput>(tokens, (tok) => [ci("title", tok), ci("description", tok)]),
          select: { id: true, title: true, status: true, priority: true },
          take: PER_TYPE,
          orderBy: { createdAt: "desc" },
        }),

        // Quotes — number, title + contact name
        prisma.quote.findMany({
          where: allTokens<Prisma.QuoteWhereInput>(tokens, (tok) => [
            ci("quoteNumber", tok), ci("title", tok),
            { contact: { OR: [ci("firstName", tok), ci("lastName", tok), ci("phone", tok)] } },
          ]),
          select: {
            id: true, quoteNumber: true, title: true, status: true,
            contact: { select: { firstName: true, lastName: true } },
          },
          take: PER_TYPE,
          orderBy: { createdAt: "desc" },
        }),

        // Contracts — title + contact name
        prisma.contract.findMany({
          where: allTokens<Prisma.ContractWhereInput>(tokens, (tok) => [
            ci("title", tok),
            { contact: { OR: [ci("firstName", tok), ci("lastName", tok), ci("phone", tok)] } },
          ]),
          select: {
            id: true, title: true, status: true,
            contact: { select: { firstName: true, lastName: true } },
          },
          take: PER_TYPE,
          orderBy: { createdAt: "desc" },
        }),

        // Vendors — name, company, email, phone
        prisma.vendor.findMany({
          where: allTokens<Prisma.VendorWhereInput>(tokens, (tok) => [
            ci("name", tok), ci("company", tok), ci("email", tok), ci("phone", tok),
          ]),
          select: { id: true, name: true, category: true, company: true },
          take: PER_TYPE,
          orderBy: { name: "asc" },
        }),

        // Packages — name, description, eventType
        prisma.eventPackage.findMany({
          where: allTokens<Prisma.EventPackageWhereInput>(tokens, (tok) => [ci("name", tok), ci("description", tok), ci("eventType", tok)]),
          select: { id: true, name: true, tier: true, eventType: true },
          take: PER_TYPE,
          orderBy: { name: "asc" },
        }),

        // Campaigns — name
        prisma.campaign.findMany({
          where: allTokens<Prisma.CampaignWhereInput>(tokens, (tok) => [ci("name", tok)]),
          select: { id: true, name: true, status: true },
          take: PER_TYPE,
          orderBy: { createdAt: "desc" },
        }),
      ]);

    // ---- BD records (acquisition) — only for users with BD access ----
    const [bdLeads, bdDeals, bdProps, bdOwners] = canBd
      ? await Promise.all([
          prisma.acqLead.findMany({
            where: {
              deletedAt: null,
              ...allTokens<Prisma.AcqLeadWhereInput>(tokens, (tok) => [
                ci("propertyName", tok), ci("ownerName", tok), ci("city", tok), ci("mobilePrimary", tok),
              ]),
            },
            select: { id: true, propertyName: true, ownerName: true, city: true, status: true },
            take: PER_TYPE,
            orderBy: { createdAt: "desc" },
          }),
          prisma.acqDeal.findMany({
            where: {
              deletedAt: null,
              ...allTokens<Prisma.AcqDealWhereInput>(tokens, (tok) => [
                ci("name", tok), ci("propertyName", tok), ci("ownerName", tok), ci("city", tok),
              ]),
            },
            select: { id: true, name: true, propertyName: true, city: true, stage: true },
            take: PER_TYPE,
            orderBy: { updatedAt: "desc" },
          }),
          prisma.acqProperty.findMany({
            where: {
              deletedAt: null,
              ...allTokens<Prisma.AcqPropertyWhereInput>(tokens, (tok) => [
                ci("propertyName", tok), ci("ownerName", tok), ci("city", tok), ci("address", tok),
              ]),
            },
            select: { id: true, propertyName: true, ownerName: true, city: true, status: true },
            take: PER_TYPE,
            orderBy: { createdAt: "desc" },
          }),
          prisma.hallOwner.findMany({
            where: { deletedAt: null, ...allTokens<Prisma.HallOwnerWhereInput>(tokens, (tok) => [
              ci("ownerName", tok), ci("companyName", tok), ci("email", tok), ci("phone", tok), ci("propertyCity", tok),
            ]) },
            select: { id: true, ownerName: true, companyName: true, propertyCity: true, contractStatus: true },
            take: PER_TYPE,
            orderBy: { ownerName: "asc" },
          }),
        ])
      : [[], [], [], []];

    const results: (SearchResult & { score: number })[] = [
      ...contacts.map((c) => {
        const title = `${c.firstName} ${c.lastName}`.trim();
        const subtitle = c.email ?? c.phone ?? c.company ?? "Contact";
        return { id: c.id, type: "contact" as const, title, subtitle, href: `/contacts/${c.id}`, score: scoreOf(title, subtitle, trimmed, tokens) };
      }),
      ...leads.map((l) => {
        const subtitle = `${l.contact.firstName} ${l.contact.lastName} · ${l.status}`;
        return { id: l.id, type: "lead" as const, title: l.title, subtitle, href: `/leads/${l.id}`, score: scoreOf(l.title, subtitle, trimmed, tokens) };
      }),
      ...bookings.map((b) => {
        const subtitle = `${b.bookingNumber} · ${b.venue.name} · ${b.contact.firstName} ${b.contact.lastName}`;
        return { id: b.id, type: "booking" as const, title: b.eventName, subtitle, href: `/bookings/${b.id}`, score: scoreOf(b.eventName, subtitle, trimmed, tokens) };
      }),
      ...invoices.map((i) => {
        const subtitle = `${i.contact.firstName} ${i.contact.lastName} · ${i.status}`;
        return { id: i.id, type: "invoice" as const, title: i.invoiceNumber, subtitle, href: `/invoices/${i.id}`, score: scoreOf(i.invoiceNumber, subtitle, trimmed, tokens) };
      }),
      ...tasks.map((t) => {
        const subtitle = `${t.priority} · ${t.status}`;
        return { id: t.id, type: "task" as const, title: t.title, subtitle, href: `/tasks/${t.id}`, score: scoreOf(t.title, subtitle, trimmed, tokens) };
      }),
      ...quotes.map((q) => {
        const title = `${q.quoteNumber} — ${q.title}`;
        const subtitle = `${q.contact.firstName} ${q.contact.lastName} · ${q.status}`;
        return { id: q.id, type: "quote" as const, title, subtitle, href: `/quotes/${q.id}`, score: scoreOf(title, subtitle, trimmed, tokens) };
      }),
      ...contracts.map((c) => {
        const subtitle = `${c.contact.firstName} ${c.contact.lastName} · ${c.status}`;
        return { id: c.id, type: "contract" as const, title: c.title, subtitle, href: `/contracts/${c.id}`, score: scoreOf(c.title, subtitle, trimmed, tokens) };
      }),
      ...vendors.map((v) => {
        const subtitle = `${v.category}${v.company ? ` · ${v.company}` : ""}`;
        return { id: v.id, type: "vendor" as const, title: v.name, subtitle, href: `/vendors/${v.id}`, score: scoreOf(v.name, subtitle, trimmed, tokens) };
      }),
      ...packages.map((p) => {
        const subtitle = `${p.tier}${p.eventType ? ` · ${p.eventType}` : ""}`;
        return { id: p.id, type: "package" as const, title: p.name, subtitle, href: `/packages/${p.id}`, score: scoreOf(p.name, subtitle, trimmed, tokens) };
      }),
      ...campaigns.map((c) => {
        const subtitle = `Campaign · ${c.status}`;
        return { id: c.id, type: "campaign" as const, title: c.name, subtitle, href: `/campaigns/${c.id}`, score: scoreOf(c.name, subtitle, trimmed, tokens) };
      }),
      ...bdLeads.map((l) => {
        const subtitle = `${l.ownerName} · ${l.city} · ${l.status}`;
        return { id: l.id, type: "bd_lead" as const, title: l.propertyName, subtitle, href: `/bd/leads/${l.id}`, score: scoreOf(l.propertyName, subtitle, trimmed, tokens) };
      }),
      ...bdDeals.map((d) => {
        const subtitle = `${d.propertyName} · ${d.city} · ${d.stage}`;
        return { id: d.id, type: "bd_deal" as const, title: d.name, subtitle, href: `/bd/deals/${d.id}`, score: scoreOf(d.name, subtitle, trimmed, tokens) };
      }),
      ...bdProps.map((p) => {
        const subtitle = `${p.ownerName} · ${p.city} · ${p.status}`;
        return { id: p.id, type: "bd_property" as const, title: p.propertyName, subtitle, href: `/bd/properties/${p.id}`, score: scoreOf(p.propertyName, subtitle, trimmed, tokens) };
      }),
      ...bdOwners.map((o) => {
        const subtitle = `${o.companyName ?? o.propertyCity ?? "Owner"} · ${o.contractStatus}`;
        return { id: o.id, type: "bd_owner" as const, title: o.ownerName, subtitle, href: `/owners/${o.id}/edit`, score: scoreOf(o.ownerName, subtitle, trimmed, tokens) };
      }),
    ];

    // Rank by relevance (then keep deterministic order), cap the payload. Sorting
    // the flat list by score means the most-relevant entity type surfaces first
    // when the client groups by type.
    results.sort((a, b) => b.score - a.score);
    const ranked = results.slice(0, GLOBAL_CAP).map(({ score: _score, ...r }) => r);

    return { success: true, data: ranked };
  } catch (error) {
    console.error("[GLOBAL_SEARCH_ERROR]", error);
    return { success: false, data: [], error: "Search failed" };
  }
}
