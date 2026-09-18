import { prisma } from "@/lib/prisma";
import { auth } from "@/../auth";
import { getVerifiedContactIds } from "@/lib/portal-identity";
import {
  computeQuotation,
  PAYMENT_TERMS_LINES,
  type QuotationInput,
  type QuotationResult,
} from "@/lib/sales/quotation-calc";
import { renderBookingTermsQuoteHtml } from "@/lib/legal/booking-terms";
import { COMPANY_LEGAL_LINE, COMPANY_ADDRESS, COMPANY_GSTIN } from "@/lib/constants";
import { SLOT_LABEL, plannerSlotToEnum } from "@/lib/sales/slot";
import {
  decideQuotationPdfAccess,
  shareTokenParam,
  staffMayReadQuotations,
  type QuotationShareLinkFact,
} from "./access";

export const runtime = "nodejs";

// ============================================================
// Sales quotation — branded, print-to-PDF document.
// Rendered server-side from the FROZEN snapshot (outputsJson), so what
// the sales manager approved is exactly what the customer sees.
// Opened from the team's quotation page, the customer's documents screen and
// links sent to the customer. The id alone opens nothing: ./access.ts decides
// who may (a team login with quotes:read, the customer's own verified login,
// or ?token= of a live /q share link). For them it serves only quotations
// finalised for the customer: APPROVED, SENT, or CONVERTED (accepted and
// turned into a booking). Drafts, quotations waiting for approval and ones
// returned for changes are never served.
// ============================================================

/** Statuses whose frozen snapshot may be shown to the customer. */
const CUSTOMER_VISIBLE_STATUSES = new Set<string>(["APPROVED", "SENT", "CONVERTED"]);

/** On every answer: never cached, indexed or sniffed, and a token in the address never leaves in a Referer. */
const PRIVATE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

/** One answer for "no such quotation" and "not yours", so a guessed id reveals nothing. */
function notAvailable(): Response {
  return new Response("This quotation isn't available. Open it from the Veloria Grand app, or from the link we sent you.", {
    status: 404,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await prisma.salesQuotation.findUnique({
    where: { id },
    include: { venue: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
  });
  if (!q) return notAvailable();

  // Who is asking. A session that still owes its second factor counts as signed out.
  const session = await auth();
  const user = session?.user?.id && !session.user.twoFactorPending ? session.user : null;
  const viewer = user ? { role: user.role, perms: user.perms } : null;
  const token = shareTokenParam(new URL(req.url).searchParams.get("token"));

  let shareLinks: QuotationShareLinkFact[] = [];
  let verifiedContactIds: string[] = [];
  if (!staffMayReadQuotations(viewer)) {
    [shareLinks, verifiedContactIds] = await Promise.all([
      token
        ? prisma.quoteShareLink.findMany({
            // A link shows this quotation as its primary quote or as one of its tiers.
            where: { OR: [{ primaryQuotationId: q.id }, { tiers: { some: { quotationId: q.id } } }] },
            select: { token: true, status: true, expiresAt: true },
            take: 50,
          })
        : Promise.resolve([]),
      user && q.contactId ? getVerifiedContactIds(user.id) : Promise.resolve([]),
    ]);
  }

  const access = decideQuotationPdfAccess({
    contactId: q.contactId,
    viewer,
    verifiedContactIds,
    token,
    shareLinks,
    now: new Date(),
  });
  if (!access.allowed) return notAvailable();

  if (!CUSTOMER_VISIBLE_STATUSES.has(q.status)) {
    return new Response("This quotation is not finalized.", { status: 403, headers: PRIVATE_HEADERS });
  }

  // Prefer the frozen snapshot; fall back to recompute (defensive).
  const result: QuotationResult =
    (q.outputsJson as unknown as QuotationResult) ||
    computeQuotation(q.inputsJson as unknown as QuotationInput);

  const clientName =
    q.clientName ||
    [q.contact?.firstName, q.contact?.lastName].filter(Boolean).join(" ") ||
    "Guest";
  const eventDate = q.eventDate
    ? new Date(q.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
    : "—";
  const quotationDate = new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  const lineRows = result.lines
    .map(
      (l) => `<tr>
        <td class="c">${l.sl}</td>
        <td>${esc(l.particulars)}</td>
        <td>${esc(l.plan)}</td>
        <td class="r">${inr(l.amount)}</td>
      </tr>`
    )
    .join("");

  const discountRow =
    result.discountAmount > 0
      ? `<tr><td colspan="3" class="r">Discount (${Number(result.discountPct)}%)</td><td class="r">− ${inr(result.discountAmount)}</td></tr>`
      : "";

  const scheduleRows = result.paymentSchedule
    .map(
      (p) => `<tr>
        <td>${esc(p.label)} (${p.pct}%)</td>
        <td>${esc(p.dueHint)}</td>
        <td class="r">${inr(p.amount)}</td>
      </tr>`
    )
    .join("");

  const detail = (label: string, value: string) =>
    `<div class="d"><span>${label}</span><strong>${esc(value)}</strong></div>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Quotation ${esc(q.quoteNumber)} — Veloria Grand</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: ${PLUM}; background: ${IVORY}; margin: 0; padding: 24px; }
  .doc { max-width: 820px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${GOLD}; padding-bottom: 14px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .brand small { display:block; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: ${GOLD}; }
  .title { font-size: 15px; font-weight: 700; text-align: right; }
  .title small { display:block; font-weight: 500; color: #6b5b73; }
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 16px 0; font-size: 12.5px; }
  .d { display:flex; justify-content: space-between; border-bottom: 1px dashed #e6dccb; padding: 4px 0; }
  .d span { color: #6b5b73; }
  h2 { font-size: 13px; margin: 18px 0 8px; padding: 6px 10px; background: ${PLUM}; color: ${IVORY}; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(45,27,61,.08); }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #efe7dd; }
  th { background: ${PLUM}; color: ${IVORY}; font-weight: 600; font-size: 11px; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  td.c { text-align: center; color: #6b5b73; width: 36px; }
  .totals { margin-top: 4px; }
  .totals td { border:0; padding: 4px 10px; }
  .totals tr.grand td { background: #f6efe2; color: ${PLUM}; font-weight: 800; font-size: 14px; padding: 9px 10px; }
  .bank { font-size: 11.5px; color: #4a3d52; line-height: 1.7; }
  .terms { font-size: 11.5px; color: #4a3d52; line-height: 1.7; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e6dccb; font-size: 10.5px; color: #6b5b73; display:flex; justify-content: space-between; }
  .actions { text-align:center; margin: 8px 0 18px; }
  .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  @media print { .actions { display:none; } body { padding: 0; } }
</style></head>
<body>
  <div class="doc">
    <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
    <div class="header">
      <div class="brand"><img src="/logo.png" alt="Veloria Grand" style="height:44px;width:auto;display:block;margin-bottom:6px" onerror="this.style.display='none'"/>Veloria Grand<small>${esc(COMPANY_LEGAL_LINE)}</small><small>Premium Event Venues</small><small>${esc(COMPANY_ADDRESS)}</small>${COMPANY_GSTIN ? `<small>GSTIN: ${esc(COMPANY_GSTIN)}</small>` : ""}</div>
      <div class="title">Event Quotation<small>${esc(q.quoteNumber)}</small></div>
    </div>

    <div class="details">
      ${detail("Client", clientName)}
      ${detail("Quotation Date", quotationDate)}
      ${detail("Phone", q.clientPhone || "—")}
      ${detail("Event Date", eventDate)}
      ${detail("Occasion", q.occasion || "—")}
      ${detail("Time Slot", q.timeSlot ? SLOT_LABEL[plannerSlotToEnum(q.timeSlot)] : "—")}
      ${detail("Hall", q.venue?.name || "—")}
      ${detail("Guests", String(q.guestCount))}
    </div>

    <h2>Quotation</h2>
    <table>
      <thead><tr><th class="c">#</th><th>Particulars</th><th>Plan</th><th class="r">Amount</th></tr></thead>
      <tbody>${lineRows}</tbody>
    </table>

    <table class="totals">
      <tbody>
        <tr><td colspan="3" class="r">Subtotal</td><td class="r">${inr(result.subtotal)}</td></tr>
        ${discountRow}
        <tr><td colspan="3" class="r">Tax (${result.taxRate != null ? +(result.taxRate * 100).toFixed(2) : 5}%)</td><td class="r">${inr(result.tax)}</td></tr>
        <tr class="grand"><td colspan="3" class="r">Grand Total</td><td class="r">${inr(result.grandTotal)}</td></tr>
      </tbody>
    </table>

    <h2>Payment Schedule</h2>
    <table>
      <thead><tr><th>Installment</th><th>Due</th><th class="r">Amount</th></tr></thead>
      <tbody>${scheduleRows}</tbody>
    </table>

    <h2>Banking Details</h2>
    <p class="bank">
      A/c Name: Billion Events Hospitality Services Pvt Ltd.<br/>
      A/c No: 44772679325 &nbsp;·&nbsp; IFSC: SBIN0009041 &nbsp;·&nbsp; Branch: Mico Layout<br/>
      UPI: billioneventshospitality@sbi
    </p>

    <h2>Payment Terms</h2>
    <p class="terms">
      ${PAYMENT_TERMS_LINES.join("<br/>\n      ")}
    </p>

    ${renderBookingTermsQuoteHtml()}

    <div class="footer">
      <span>${q.status === "CONVERTED" ? "This quotation was accepted and converted to a booking." : "This quotation is valid for 15 days."} Prices inclusive of applicable taxes as shown.</span>
      <span>Generated ${quotationDate}</span>
    </div>
  </div>
</body></html>`;

  // Safari treats a URL ending in `/pdf` as a file to download (saving a
  // plain, extension-less "pdf" file that opens as raw text) unless the
  // response explicitly declares `inline` disposition. Chrome renders inline
  // either way; this header makes Safari render the branded page in-tab too,
  // where the customer can use "Save as PDF / Print".
  const safeName = (q.quoteNumber || "quotation").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return new Response(html, {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="Quotation-${safeName}.html"`,
    },
  });
}
