// ============================================================
// Customer receipt and invoice documents — print-to-PDF HTML (pure strings).
// ------------------------------------------------------------
// Every figure printed here is a stored field of the team's own records,
// formatted with the team's formatINR. Nothing is computed, except what the
// shared rules decide (src/lib/finance/invoice-presentation.ts): an invoice's
// title and its balance line, which is what is still owed, or why nothing is
// (a full refund puts the stored balanceDue back to the invoice total).
//
// INVOICE: mirrors the team's print page, src/app/(print)/invoices/[invoiceId]/pdf
// (same title and balance rules, tax rows, totals, terms and footer), so the customer's copy
// matches the one finance prints. That page is bound to staff auth and loads
// its own data, so it cannot serve a customer or an invited co-host directly.
// If the layout changes there, change it here too (or extract one shared
// renderer; see the integration notes).
//
// RECEIPT: the team has no receipt document of its own. A receipt is the
// Payment row (receiptNumber from the shared FinSequence counter) plus its
// invoice, so that is exactly what this prints.
// ============================================================

import { formatINR } from "@/lib/utils";
import { COMPANY_ADDRESS, COMPANY_GSTIN, COMPANY_LEGAL_LINE, LEGACY_INVOICE_TERMS } from "@/lib/constants";
import { invoicePresentation } from "@/lib/finance/invoice-presentation";
import { PAYMENT_TERMS_LINES } from "@/lib/sales/quotation-calc";

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

const IST = "Asia/Kolkata";

function istDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: IST });
}

function istDateTime(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: IST,
  });
}

const STYLES = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px; background: #f4f4f5; color: #18181b; font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  .doc { max-width: 210mm; margin: 0 auto; padding: 32px; background: #fff; border-radius: 12px; }
  .actions { max-width: 210mm; margin: 0 auto 12px; text-align: right; }
  .actions button { padding: 8px 18px; border: 0; border-radius: 8px; background: #18181b; color: #fff; font-weight: 600; font-size: 13px; cursor: pointer; }
  .head { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; align-items: flex-start; }
  .company h1 { margin: 0; font-size: 22px; font-weight: 700; }
  .company p { margin: 4px 0 0; font-size: 12px; color: #71717a; }
  .company p.legal { font-weight: 600; color: #3f3f46; }
  .meta { text-align: right; }
  .meta h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: .02em; }
  .meta .number { margin-top: 4px; font-size: 14px; font-weight: 500; }
  .meta .dates { margin-top: 8px; font-size: 12px; color: #52525b; }
  .meta .dates span { font-weight: 500; }
  .badge { display: inline-block; margin-top: 8px; padding: 2px 10px; border-radius: 999px; background: #f4f4f5; color: #52525b; font-size: 11px; font-weight: 600; }
  hr { border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px 24px; }
  .label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 4px; }
  .value { font-size: 13px; font-weight: 500; overflow-wrap: anywhere; }
  .detail { font-size: 12px; color: #52525b; }
  .detail-row { font-size: 12px; margin-bottom: 4px; }
  .detail-row .k { color: #71717a; }
  .amount { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px; padding: 16px 20px; margin-bottom: 24px; border: 1px solid #bbf7d0; border-radius: 10px; background: #f0fdf4; }
  .amount strong { font-size: 24px; color: #15803d; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  thead th { padding: 8px 0; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #71717a; border-bottom: 2px solid #e4e4e7; }
  tbody td { padding: 10px 0; border-bottom: 1px solid #f4f4f5; }
  .r { text-align: right; white-space: nowrap; }
  .totals { display: flex; justify-content: flex-end; margin-top: 16px; }
  .totals-table { width: 100%; max-width: 280px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; }
  .row .k { color: #71717a; }
  .row.discount .v { color: #dc2626; }
  .row.total { font-size: 15px; font-weight: 700; border-top: 2px solid #e4e4e7; padding-top: 8px; margin-top: 4px; }
  .row.paid .v { color: #15803d; }
  .row.balance { font-size: 16px; font-weight: 700; }
  .row.balance .v.due { color: #dc2626; }
  .row.balance .v.clear { color: #15803d; }
  .row.balance .v.muted { color: #71717a; }
  .notes { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e4e4e7; }
  .notes h4 { margin: 0 0 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; }
  .notes p { margin: 0 0 12px; font-size: 12px; color: #52525b; white-space: pre-line; }
  .caption { margin-top: 24px; font-size: 12px; color: #71717a; }
  .foot { margin-top: 28px; padding-top: 12px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 11px; color: #a1a1aa; }
  @media print {
    body { padding: 0; background: #fff; }
    .actions { display: none; }
    .doc { padding: 0; border-radius: 0; }
  }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style></head>
<body>
<div class="actions"><button type="button" onclick="window.print()">Save as PDF / Print</button></div>
<main class="doc">${body}</main>
<script>if (location.search.indexOf("auto=1") !== -1) setTimeout(function () { window.print(); }, 400);</script>
</body></html>`;
}

function companyBlock(): string {
  return `<div class="company">
    <h1>Veloria Grand</h1>
    <p class="legal">${escapeHtml(COMPANY_LEGAL_LINE)}</p>
    <p>Premium Event &amp; Banquet Services</p>
    <p>${escapeHtml(COMPANY_ADDRESS)}<br/>GSTIN: ${escapeHtml(COMPANY_GSTIN || "Not Configured")}</p>
  </div>`;
}

// ------------------------------------------------------------ receipt

export interface ReceiptDocumentData {
  receiptNumber: string | null;
  /** Payment.amount */
  amount: number;
  methodLabel: string;
  statusLabel: string;
  paidAt: Date | null;
  transactionId: string | null;
  /** The invoice's customer (a split share may have been paid by someone else). */
  customerName: string;
  invoiceNumber: string;
  /** Invoice.totalAmount / paidAmount / balanceDue as they stand when the file is generated. */
  invoiceTotal: number;
  invoicePaid: number;
  invoiceBalanceDue: number;
  /**
   * Invoice.status. With it, the balance line follows the shared owed rule
   * (src/lib/finance/invoice-presentation.ts): a refunded or cancelled invoice
   * says so instead of printing the balanceDue a full refund restores to the
   * total. Without it the stored balanceDue is printed, as before.
   */
  invoiceStatus?: string;
  eventName: string | null;
  eventDate: Date | null;
  bookingNumber: string | null;
  venueName: string | null;
  generatedAt: Date;
}

export function renderReceiptHtml(d: ReceiptDocumentData): string {
  // The invoice's balance line by the shared owed rule once the route passes the
  // invoice status; without it, the stored balanceDue as before.
  const shared =
    d.invoiceStatus === undefined
      ? null
      : invoicePresentation({ status: d.invoiceStatus, balanceDue: d.invoiceBalanceDue });
  const balanceLine = shared
    ? { label: shared.balanceLabel, tone: shared.tone }
    : { label: formatINR(d.invoiceBalanceDue), tone: d.invoiceBalanceDue > 0 ? "due" : "clear" };
  const field = (label: string, value: string) =>
    `<div><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`;
  const body = `
  <div class="head">
    ${companyBlock()}
    <div class="meta">
      <h2>PAYMENT RECEIPT</h2>
      <div class="number">${escapeHtml(d.receiptNumber ?? "—")}</div>
      <div class="badge">${escapeHtml(d.statusLabel)}</div>
    </div>
  </div>
  <hr/>
  <div class="amount"><span>Amount received</span><strong>${escapeHtml(formatINR(d.amount))}</strong></div>
  <div class="grid">
    ${field("Customer", d.customerName || "—")}
    ${field("Date", d.paidAt ? `${istDateTime(d.paidAt)} IST` : "—")}
    ${field("Payment method", d.methodLabel)}
    ${d.transactionId ? field("Transaction reference", d.transactionId) : ""}
    ${field("Towards invoice", d.invoiceNumber)}
    ${d.bookingNumber ? field("Booking", d.bookingNumber) : ""}
    ${d.eventName ? field("Event", `${d.eventName}${d.eventDate ? ` · ${istDate(d.eventDate)}` : ""}`) : ""}
    ${d.venueName ? field("Venue", d.venueName) : ""}
  </div>
  <p class="caption">Invoice ${escapeHtml(d.invoiceNumber)} as of ${escapeHtml(istDate(d.generatedAt))}</p>
  <div class="totals" style="justify-content:flex-start;margin-top:4px">
    <div class="totals-table">
      <div class="row"><span class="k">Invoice total</span><span class="v">${escapeHtml(formatINR(d.invoiceTotal))}</span></div>
      <div class="row paid"><span class="k">Paid to date</span><span class="v">${escapeHtml(formatINR(d.invoicePaid))}</span></div>
      <div class="row balance"><span>Balance due</span><span class="v ${balanceLine.tone}">${escapeHtml(balanceLine.label)}</span></div>
    </div>
  </div>
  <div class="foot">This is a computer-generated receipt and does not require a signature. Generated ${escapeHtml(istDateTime(d.generatedAt))} IST.</div>`;
  return page(`Receipt ${d.receiptNumber ?? ""} — Veloria Grand`.replace("  ", " "), body);
}

// ------------------------------------------------------------ invoice

export interface InvoiceDocumentData {
  invoiceNumber: string;
  status: string;
  statusLabel: string;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  notes: string | null;
  terms: string | null;
  gstin: string | null;
  placeOfSupply: string | null;
  sacCode: string | null;
  contact: {
    firstName: string;
    lastName: string | null;
    company: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    email: string | null;
    phone: string | null;
  };
  booking: { bookingNumber: string; eventName: string; eventType: string; date: Date; venueName: string | null } | null;
  lineItems: { description: string; quantity: number; unitPrice: number; amount: number }[];
}

/** The team's title rule, shared by all three invoice documents (src/lib/finance/invoice-presentation.ts). */
export { invoiceDocumentTitle } from "@/lib/finance/invoice-presentation";

export function renderInvoiceHtml(inv: InvoiceDocumentData): string {
  // Title and balance line by the shared rules, as the team's print page and the portal PDF print them.
  const view = invoicePresentation(inv);
  const fullyPaid = view.title === "TAX INVOICE";
  const isInterstate = inv.igstRate > 0;
  const customTerms = inv.terms && inv.terms.trim() !== LEGACY_INVOICE_TERMS.trim() ? inv.terms : null;
  const c = inv.contact;
  const row = (cls: string, k: string, v: string) =>
    `<div class="row ${cls}"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></div>`;

  const taxRows = !isInterstate
    ? `${inv.cgstAmount > 0 ? row("", `CGST (${inv.cgstRate}%)`, formatINR(inv.cgstAmount)) : ""}${
        inv.sgstAmount > 0 ? row("", `SGST (${inv.sgstRate}%)`, formatINR(inv.sgstAmount)) : ""
      }`
    : inv.igstAmount > 0
      ? row("", `IGST (${inv.igstRate}%)`, formatINR(inv.igstAmount))
      : "";

  const addressLine = c.address
    ? `${c.address}${c.city ? `, ${c.city}` : ""}${c.state ? `, ${c.state}` : ""}${c.pincode ? ` - ${c.pincode}` : ""}`
    : null;

  const body = `
  <div class="head">
    ${companyBlock()}
    <div class="meta">
      <h2>${fullyPaid ? "TAX INVOICE" : "PROFORMA INVOICE"}</h2>
      <div class="number">${escapeHtml(inv.invoiceNumber)}</div>
      <div class="dates">
        <div><span>Issue Date:</span> ${escapeHtml(istDate(inv.issueDate))}</div>
        <div><span>Due Date:</span> ${escapeHtml(istDate(inv.dueDate))}</div>
      </div>
      <div class="badge">${escapeHtml(inv.statusLabel)}</div>
    </div>
  </div>
  <hr/>
  <div class="grid">
    <div>
      <div class="label">Bill To</div>
      <div class="value">${escapeHtml(`${c.firstName} ${c.lastName ?? ""}`.trim())}</div>
      ${c.company ? `<div class="detail">${escapeHtml(c.company)}</div>` : ""}
      ${addressLine ? `<div class="detail">${escapeHtml(addressLine)}</div>` : ""}
      ${c.email ? `<div class="detail">${escapeHtml(c.email)}</div>` : ""}
      ${c.phone ? `<div class="detail">${escapeHtml(c.phone)}</div>` : ""}
      ${inv.gstin ? `<div class="detail" style="margin-top:4px"><span style="font-weight:500">GSTIN:</span> ${escapeHtml(inv.gstin)}</div>` : ""}
    </div>
    <div>
      <div class="label">Invoice Details</div>
      ${inv.placeOfSupply ? `<div class="detail-row"><span class="k">Place of Supply: </span>${escapeHtml(inv.placeOfSupply)}</div>` : ""}
      ${inv.sacCode ? `<div class="detail-row"><span class="k">SAC Code: </span>${escapeHtml(inv.sacCode)}</div>` : ""}
      ${
        inv.booking
          ? `<div class="detail-row"><span class="k">Booking: </span>${escapeHtml(inv.booking.bookingNumber)}</div>
      <div class="detail-row"><span class="k">Event: </span>${escapeHtml(`${inv.booking.eventName} (${inv.booking.eventType})`)}</div>
      <div class="detail-row"><span class="k">Date: </span>${escapeHtml(istDate(inv.booking.date))}</div>
      ${inv.booking.venueName ? `<div class="detail-row"><span class="k">Venue: </span>${escapeHtml(inv.booking.venueName)}</div>` : ""}`
          : ""
      }
    </div>
  </div>
  <div style="overflow-x:auto">
  <table>
    <thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr></thead>
    <tbody>
      ${inv.lineItems
        .map(
          (li, i) =>
            `<tr><td>${i + 1}</td><td>${escapeHtml(li.description)}</td><td class="r">${escapeHtml(li.quantity)}</td><td class="r">${escapeHtml(formatINR(li.unitPrice))}</td><td class="r">${escapeHtml(formatINR(li.amount))}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
  </div>
  <div class="totals">
    <div class="totals-table">
      ${row("", "Subtotal", formatINR(inv.subtotal))}
      ${inv.discountAmount > 0 ? row("discount", `Discount (${inv.discountPercent}%)`, `-${formatINR(inv.discountAmount)}`) : ""}
      ${taxRows}
      <div class="row total"><span>Total</span><span>${escapeHtml(formatINR(inv.totalAmount))}</span></div>
      ${row("paid", "Paid", formatINR(inv.paidAmount))}
      <div class="row balance"><span>Balance Due</span><span class="v ${view.tone}">${escapeHtml(view.balanceLabel)}</span></div>
    </div>
  </div>
  ${
    inv.notes || customTerms
      ? `<div class="notes">${inv.notes ? `<h4>Notes</h4><p>${escapeHtml(inv.notes)}</p>` : ""}${
          customTerms ? `<h4>Terms &amp; Conditions</h4><p>${escapeHtml(customTerms)}</p>` : ""
        }</div>`
      : ""
  }
  ${
    fullyPaid
      ? ""
      : `<div class="notes"><h4>Payment Terms</h4><p>${escapeHtml(PAYMENT_TERMS_LINES.join("\n"))}\n\nThis is a Proforma Invoice for advance/part payment and is not a tax document. A Tax Invoice will be issued once full payment is received.</p></div>`
  }
  <div class="foot">${
    fullyPaid
      ? "This is a computer-generated tax invoice and does not require a physical signature."
      : "This is a computer-generated proforma invoice and does not require a physical signature."
  }</div>`;
  return page(`${fullyPaid ? "Tax Invoice" : "Proforma Invoice"} ${inv.invoiceNumber} — Veloria Grand`, body);
}
