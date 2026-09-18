// ============================================================
// Quote share links: reuse a quotation's live /q/<token> link, or mint one.
// ------------------------------------------------------------
// The one place a share link is found or created for a quotation. Used by the
// rep's Share button (createQuoteShareLink) and by "Send to customer" by email
// (sendSalesQuotation): the printout at /api/quotations/<id>/pdf opens for a
// customer who isn't signed in only with ?token= of a live share link
// (access.ts next to that route), so the emailed link must carry one.
//
// No "use server" and no permission check here: every caller is a server
// action that has already checked the signed-in user may send or share this
// quotation. Exported from a "use server" file this would be a public endpoint.
// ============================================================

import { Prisma } from "@prisma/client";
import { isLiveQuotationShareLink } from "@/app/api/quotations/[id]/pdf/access";
import { generateShareToken } from "@/lib/quote-radar/token";

/** The quotation columns a link copies (its headline) or stamps (shareLinkToken). */
export interface ShareableQuotation {
  id: string;
  quoteGroupId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  occasion: string | null;
  eventDate: Date | null;
  timeSlot: string | null;
  grandTotal: Prisma.Decimal | null;
  leadId: string | null;
  contactId: string | null;
  venueId: string | null;
  shareLinkToken: string | null;
}

export interface EnsuredQuoteShareLink {
  id: string;
  token: string;
  payInvoiceId: string | null;
  /** True when this call minted the link. */
  created: boolean;
}

type ShareLinkDb = Pick<Prisma.TransactionClient, "quoteShareLink" | "salesQuotation">;

/** ACTIVE links looked at for a live one; a quotation normally has one. */
const REUSE_SCAN = 20;

/**
 * The quotation's newest live share link, or a new ACTIVE one. Live is the rule
 * /q/<token> and the printout both apply (ACTIVE and not past expiresAt), so an
 * expired link is never handed out again. Stamps SalesQuotation.shareLinkToken
 * so the rep's screen shows the link.
 */
export async function ensureQuoteShareLink(
  db: ShareLinkDb,
  quotation: ShareableQuotation,
  opts: { actorId: string; now?: Date }
): Promise<EnsuredQuoteShareLink> {
  const now = opts.now ?? new Date();
  const active = await db.quoteShareLink.findMany({
    where: { primaryQuotationId: quotation.id, status: "ACTIVE" },
    select: { id: true, token: true, status: true, expiresAt: true, payInvoiceId: true },
    orderBy: { createdAt: "desc" },
    take: REUSE_SCAN,
  });
  const live = active.find((link) => isLiveQuotationShareLink(link, now));

  if (live) {
    if (quotation.shareLinkToken !== live.token) {
      await db.salesQuotation.update({ where: { id: quotation.id }, data: { shareLinkToken: live.token } });
    }
    return { id: live.id, token: live.token, payInvoiceId: live.payInvoiceId, created: false };
  }

  const minted = await db.quoteShareLink.create({
    data: {
      token: generateShareToken(),
      status: "ACTIVE",
      quoteGroupId: quotation.quoteGroupId || null,
      primaryQuotationId: quotation.id,
      leadId: quotation.leadId || null,
      contactId: quotation.contactId || null,
      venueId: quotation.venueId || null,
      clientName: quotation.clientName || null,
      clientPhone: quotation.clientPhone || null,
      occasion: quotation.occasion || null,
      eventDate: quotation.eventDate || null,
      timeSlot: quotation.timeSlot || null,
      grandTotal: quotation.grandTotal ?? new Prisma.Decimal(0),
      createdById: opts.actorId,
    },
    select: { id: true, token: true, payInvoiceId: true },
  });
  await db.salesQuotation.update({ where: { id: quotation.id }, data: { shareLinkToken: minted.token } });
  return { ...minted, created: true };
}

/** The customer's link to a quotation printout: absolute, with the share token it needs. */
export function quotationPdfShareUrl(appUrl: string, quotationId: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/api/quotations/${encodeURIComponent(quotationId)}/pdf?token=${encodeURIComponent(token)}`;
}
