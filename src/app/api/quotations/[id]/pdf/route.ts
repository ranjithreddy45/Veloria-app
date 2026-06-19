import { prisma } from "@/lib/prisma";
import { computeQuotation, type QuotationInput, type QuotationResult } from "@/lib/sales/quotation-calc";
import { renderBookingTermsQuoteHtml } from "@/lib/legal/booking-terms";
import { COMPANY_LEGAL_LINE, COMPANY_ADDRESS } from "@/lib/constants";

export const runtime = "nodejs";

// ============================================================
// Sales quotation — branded, print-to-PDF document.
// Rendered server-side from the FROZEN snapshot (outputsJson), so what
// the sales manager approved is exactly what the customer sees.
// Accessible by the unguessable id for APPROVED/SENT quotations
// (customer has no login).
// ============================================================

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await prisma.salesQuotation.findUnique({
    where: { id },
    include: { venue: { select: { name: true } }, contact: { select: { firstName: true, lastName: true } } },
  });

  if (!q) return new Response("Quotation not available.", { status: 404 });
  if (q.status !== "APPROVED" && q.status !== "SENT") {
    return new Response("This quotation is not finalized.", { status: 403 });
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
      <div class="brand"><img src="/logo.png" alt="Veloria Grand" style="height:44px;width:auto;display:block;margin-bottom:6px" onerror="this.style.display='none'"/>Veloria Grand<small>${esc(COMPANY_LEGAL_LINE)}</small><small>Premium Event Venues</small><small>${esc(COMPANY_ADDRESS)}</small></div>
      <div class="title">Event Quotation<small>${esc(q.quoteNumber)} · v${q.version}</small></div>
    </div>

    <div class="details">
      ${detail("Client", clientName)}
      ${detail("Quotation Date", quotationDate)}
      ${detail("Phone", q.clientPhone || "—")}
      ${detail("Event Date", eventDate)}
      ${detail("Occasion", q.occasion || "—")}
      ${detail("Time Slot", q.timeSlot || "—")}
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
        <tr><td colspan="3" class="r">Tax (5%)</td><td class="r">${inr(result.tax)}</td></tr>
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
      1. To block the slot — 20% on the day of booking.<br/>
      2. 60% — 15 days before the event.<br/>
      3. Balance (20%) — 2 hours before the event.
    </p>

    ${q.notes ? `<h2>Remarks</h2><p class="terms">${esc(q.notes)}</p>` : ""}

    ${renderBookingTermsQuoteHtml()}

    <div class="footer">
      <span>This quotation is valid for 15 days. Prices inclusive of applicable taxes as shown.</span>
      <span>Generated ${quotationDate}</span>
    </div>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
