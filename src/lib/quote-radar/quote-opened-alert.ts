import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";

// ============================================================
// "Your customer just opened the quote" — tell the rep while the customer is
// still looking at the price, the best moment to call.
//
// Views were already tracked on the share link (viewCount / firstViewedAt /
// lastViewedAt) but nobody was told. This sends one in-app notice (bell +
// phone push) on the FIRST real open, and again when the customer comes back
// after a gap (REOPEN_GAP_MS): a quote looked at twice is a warm buyer.
// Preview crawlers (WhatsApp link unfurl) and staff opening their own link
// never trigger it; the caller decides that.
// ============================================================

/** A return visit sooner than this is the same sitting, not news. */
export const REOPEN_GAP_MS = 6 * 60 * 60 * 1000;

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const IST_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export interface QuoteOpenedLink {
  id: string;
  leadId: string | null;
  createdById: string | null;
  clientName: string | null;
  occasion: string | null;
  eventDate: Date | null;
  grandTotal: unknown; // Prisma Decimal
  viewCount: number;
}

export function quoteOpenedTitle(clientName: string | null, kind: "first" | "again"): string {
  const who = clientName?.trim() || "Your customer";
  return kind === "first" ? `${who} just opened your quote` : `${who} is looking at your quote again`;
}

export function quoteOpenedMessage(link: Pick<QuoteOpenedLink, "occasion" | "eventDate" | "grandTotal" | "viewCount">, kind: "first" | "again"): string {
  const parts: string[] = [];
  const total = Number(link.grandTotal ?? 0);
  if (Number.isFinite(total) && total > 0) parts.push(INR.format(total));
  if (link.occasion && link.eventDate) parts.push(`${link.occasion} on ${IST_DATE.format(link.eventDate)}`);
  else if (link.occasion) parts.push(link.occasion);
  else if (link.eventDate) parts.push(`event on ${IST_DATE.format(link.eventDate)}`);
  if (kind === "again" && link.viewCount > 1) parts.push(`opened ${link.viewCount} times`);
  const head = parts.length ? `${parts.join(" · ")}. ` : "";
  return `${head}A good moment to call.`;
}

/**
 * Who hears about it: the lead's current owner (they own the follow-up), else
 * the rep who shared the link. Inactive staff and venue owners are skipped.
 */
export async function quoteOpenedRecipient(link: Pick<QuoteOpenedLink, "leadId" | "createdById">): Promise<string | null> {
  const candidates: string[] = [];
  if (link.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: link.leadId }, select: { assignedToId: true, deletedAt: true } });
    if (lead && !lead.deletedAt && lead.assignedToId) candidates.push(lead.assignedToId);
  }
  if (link.createdById) candidates.push(link.createdById);
  for (const id of candidates) {
    const u = await prisma.user.findUnique({ where: { id }, select: { isActive: true, role: true } });
    if (u && u.isActive && u.role !== "VENUE_OWNER") return id;
  }
  return null;
}

/** Send the notice. Never throws. */
export async function sendQuoteOpenedAlert(link: QuoteOpenedLink, kind: "first" | "again"): Promise<boolean> {
  try {
    const userId = await quoteOpenedRecipient(link);
    if (!userId) return false;
    await notifyAwait({
      userId,
      type: "SYSTEM",
      title: quoteOpenedTitle(link.clientName, kind),
      message: quoteOpenedMessage(link, kind),
      actionUrl: link.leadId ? `/leads/${link.leadId}` : "/quotations",
      metadata: { kind: kind === "first" ? "QUOTE_OPENED" : "QUOTE_REOPENED", shareLinkId: link.id },
    });
    return true;
  } catch (e) {
    console.error("[QUOTE_OPENED_ALERT]", e);
    return false;
  }
}
