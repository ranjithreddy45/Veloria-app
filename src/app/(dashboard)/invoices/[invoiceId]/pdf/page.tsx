import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getInvoice } from "@/actions/invoice.actions";
import { formatINR } from "@/lib/utils";
import { COMPANY_ADDRESS, COMPANY_GSTIN, COMPANY_LEGAL_LINE, LEGACY_INVOICE_TERMS } from "@/lib/constants";

// ============================================================
// Print-Optimized Invoice PDF Page
// ============================================================
// Opens in a new tab, styled for clean A4 printing/saving as PDF.
// No sidebar, no header — just the invoice.

export const metadata = {
  title: "Invoice PDF",
};

interface InvoicePdfPageProps {
  params: Promise<{ invoiceId: string }>;
}

function toNum(
  val: number | string | { toString(): string } | null | undefined
): number {
  if (val === null || val === undefined) return 0;
  return Number(val.toString());
}

export default async function InvoicePdfPage({ params }: InvoicePdfPageProps) {
  const { invoiceId } = await params;
  const result = await getInvoice(invoiceId);

  if (!result.success || !result.data) {
    notFound();
  }

  const invoice = result.data;
  const discountPercent = toNum(invoice.discountPercent);
  const discountAmount = toNum(invoice.discountAmount);
  const cgstRate = toNum(invoice.cgstRate);
  const sgstRate = toNum(invoice.sgstRate);
  const igstRate = toNum(invoice.igstRate);
  const cgstAmount = toNum(invoice.cgstAmount);
  const sgstAmount = toNum(invoice.sgstAmount);
  const igstAmount = toNum(invoice.igstAmount);
  const isInterstate = igstRate > 0;

  // A Tax Invoice is only issued once the booking is paid in full. Until then
  // the document is a Proforma Invoice (a preliminary bill, not a tax document).
  const fullyPaid = toNum(invoice.balanceDue) <= 0 || invoice.status === "PAID";
  const docTitle = fullyPaid ? "TAX INVOICE" : "PROFORMA INVOICE";

  // Drop the retired default T&C boilerplate from old invoices; keep any custom terms.
  const customTerms =
    invoice.terms && invoice.terms.trim() !== LEGACY_INVOICE_TERMS.trim()
      ? invoice.terms
      : null;

  return (
    <html lang="en">
      <head>
        <title>{docTitle} {invoice.invoiceNumber} - Veloria Grand</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @page {
                size: A4;
                margin: 15mm;
              }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #18181b;
                font-size: 13px;
                line-height: 1.5;
                background: white;
              }
              .invoice { max-width: 210mm; margin: 0 auto; padding: 40px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; }
              .company h1 { font-size: 24px; font-weight: 700; color: #18181b; }
              .company p { font-size: 12px; color: #71717a; margin-top: 4px; }
              .invoice-meta { text-align: right; }
              .invoice-meta h2 { font-size: 20px; font-weight: 700; color: #18181b; }
              .invoice-meta .number { font-size: 14px; font-weight: 500; margin-top: 4px; }
              .invoice-meta .dates { margin-top: 8px; font-size: 12px; color: #52525b; }
              .invoice-meta .dates span { font-weight: 500; }
              .status-badge {
                display: inline-block; margin-top: 8px; padding: 2px 10px;
                border-radius: 9999px; font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px;
              }
              .status-DRAFT { background: #f4f4f5; color: #71717a; }
              .status-SENT { background: #dbeafe; color: #1d4ed8; }
              .status-PAID { background: #dcfce7; color: #15803d; }
              .status-PARTIALLY_PAID { background: #fef3c7; color: #b45309; }
              .status-OVERDUE { background: #fee2e2; color: #dc2626; }
              .status-CANCELLED { background: #f4f4f5; color: #71717a; }
              .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
              .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
              .section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 8px; }
              .bill-to .name { font-weight: 600; font-size: 14px; }
              .bill-to .detail { font-size: 12px; color: #52525b; }
              .detail-row { font-size: 12px; margin-bottom: 4px; }
              .detail-row .label { color: #71717a; }
              .detail-row .value { font-weight: 500; }
              table { width: 100%; border-collapse: collapse; margin-top: 24px; }
              thead th { padding: 8px 0; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #71717a; border-bottom: 2px solid #e4e4e7; }
              thead th.right { text-align: right; }
              tbody td { padding: 10px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; }
              tbody td.right { text-align: right; }
              tbody td.bold { font-weight: 500; }
              .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
              .totals-table { width: 260px; }
              .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
              .totals-row .label { color: #71717a; }
              .totals-row .value { font-weight: 500; }
              .totals-row.discount .value { color: #dc2626; }
              .totals-row.total { font-size: 15px; font-weight: 700; border-top: 2px solid #e4e4e7; padding-top: 8px; margin-top: 4px; }
              .totals-row.paid .value { color: #15803d; }
              .totals-row.balance { font-size: 16px; font-weight: 700; }
              .totals-row.balance .value.due { color: #dc2626; }
              .totals-row.balance .value.clear { color: #15803d; }
              .notes-section { margin-top: 32px; border-top: 1px solid #e4e4e7; padding-top: 16px; }
              .notes-section h4 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 6px; }
              .notes-section p { font-size: 12px; color: #52525b; white-space: pre-line; }
              .footer { margin-top: 32px; border-top: 1px solid #e4e4e7; padding-top: 12px; text-align: center; font-size: 11px; color: #a1a1aa; }
              .auto-print-bar {
                position: fixed; top: 0; left: 0; right: 0; padding: 12px 24px;
                background: #4f46e5; color: white; display: flex; align-items: center;
                justify-content: space-between; z-index: 100; font-size: 14px;
              }
              .auto-print-bar button {
                padding: 6px 20px; background: white; color: #4f46e5;
                border: none; border-radius: 6px; font-weight: 600; cursor: pointer;
                font-size: 13px;
              }
              .auto-print-bar button:hover { background: #e0e7ff; }
              @media print {
                .auto-print-bar { display: none; }
                body { padding: 0; }
                .invoice { padding: 0; }
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.onload = function() {
                // Hide the brand logo gracefully if /logo.png isn't present yet.
                document.querySelectorAll('img.brand-logo').forEach(function(i) {
                  var hide = function() { i.style.display = 'none'; };
                  i.onerror = hide;
                  if (i.complete && i.naturalWidth === 0) hide();
                });
                if (window.location.search.includes('auto=1')) {
                  setTimeout(function() { window.print(); }, 500);
                }
                var btn = document.getElementById('print-btn');
                if (btn) {
                  btn.addEventListener('click', function() { window.print(); });
                }
              };
            `,
          }}
        />
      </head>
      <body>
        {/* Print action bar */}
        <div className="auto-print-bar">
          <span>Invoice {invoice.invoiceNumber} — Ready to save as PDF</span>
          <button id="print-btn">
            Save as PDF / Print
          </button>
        </div>

        <div className="invoice" style={{ marginTop: "60px" }}>
          {/* Header */}
          <div className="header">
            <div className="company">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Veloria Grand"
                className="brand-logo"
                style={{ height: "48px", width: "auto", marginBottom: "8px", display: "block" }}
              />
              <h1>Veloria Grand</h1>
              <p style={{ fontWeight: 600, color: "#3f3f46" }}>{COMPANY_LEGAL_LINE}</p>
              <p>Premium Event & Banquet Services</p>
              <p>
                {COMPANY_ADDRESS}
                <br />
                GSTIN: {COMPANY_GSTIN || "Not Configured"}
              </p>
            </div>
            <div className="invoice-meta">
              <h2>{docTitle}</h2>
              <div className="number">{invoice.invoiceNumber}</div>
              <div className="dates">
                <div>
                  <span>Issue Date:</span>{" "}
                  {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                </div>
                <div>
                  <span>Due Date:</span>{" "}
                  {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                </div>
              </div>
              <div className={`status-badge status-${invoice.status}`}>
                {invoice.status.replace("_", " ")}
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* Bill To & Details */}
          <div className="grid-2">
            <div className="bill-to">
              <div className="section-label">Bill To</div>
              <div className="name">
                {invoice.contact.firstName} {invoice.contact.lastName}
              </div>
              {invoice.contact.company && (
                <div className="detail">{invoice.contact.company}</div>
              )}
              {invoice.contact.address && (
                <div className="detail">
                  {invoice.contact.address}
                  {invoice.contact.city && `, ${invoice.contact.city}`}
                  {invoice.contact.state && `, ${invoice.contact.state}`}
                  {invoice.contact.pincode && ` - ${invoice.contact.pincode}`}
                </div>
              )}
              {invoice.contact.email && (
                <div className="detail">{invoice.contact.email}</div>
              )}
              {invoice.contact.phone && (
                <div className="detail">{invoice.contact.phone}</div>
              )}
              {invoice.gstin && (
                <div className="detail" style={{ marginTop: "4px" }}>
                  <span style={{ fontWeight: 500 }}>GSTIN:</span>{" "}
                  {invoice.gstin}
                </div>
              )}
            </div>
            <div>
              <div className="section-label">Invoice Details</div>
              {invoice.placeOfSupply && (
                <div className="detail-row">
                  <span className="label">Place of Supply: </span>
                  <span className="value">{invoice.placeOfSupply}</span>
                </div>
              )}
              {invoice.sacCode && (
                <div className="detail-row">
                  <span className="label">SAC Code: </span>
                  <span className="value">{invoice.sacCode}</span>
                </div>
              )}
              {invoice.booking && (
                <>
                  <div className="detail-row">
                    <span className="label">Booking: </span>
                    <span className="value">
                      {invoice.booking.bookingNumber}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Event: </span>
                    <span className="value">
                      {invoice.booking.eventName} ({invoice.booking.eventType})
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Date: </span>
                    <span className="value">
                      {format(new Date(invoice.booking.date), "dd MMM yyyy")}
                    </span>
                  </div>
                  {invoice.booking.venue && (
                    <div className="detail-row">
                      <span className="label">Venue: </span>
                      <span className="value">
                        {invoice.booking.venue.name}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th className="right">Qty</th>
                <th className="right">Unit Price</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map(
                (
                  item: {
                    id: string;
                    description: string;
                    quantity: number | string | { toString(): string };
                    unitPrice: number | string | { toString(): string };
                    amount: number | string | { toString(): string };
                  },
                  index: number
                ) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td className="bold">{item.description}</td>
                    <td className="right">{toNum(item.quantity)}</td>
                    <td className="right">{formatINR(item.unitPrice)}</td>
                    <td className="right bold">{formatINR(item.amount)}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="totals">
            <div className="totals-table">
              <div className="totals-row">
                <span className="label">Subtotal</span>
                <span className="value">{formatINR(invoice.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="totals-row discount">
                  <span className="label">Discount ({discountPercent}%)</span>
                  <span className="value">-{formatINR(discountAmount)}</span>
                </div>
              )}
              {!isInterstate ? (
                <>
                  {cgstAmount > 0 && (
                    <div className="totals-row">
                      <span className="label">CGST ({cgstRate}%)</span>
                      <span className="value">{formatINR(cgstAmount)}</span>
                    </div>
                  )}
                  {sgstAmount > 0 && (
                    <div className="totals-row">
                      <span className="label">SGST ({sgstRate}%)</span>
                      <span className="value">{formatINR(sgstAmount)}</span>
                    </div>
                  )}
                </>
              ) : (
                igstAmount > 0 && (
                  <div className="totals-row">
                    <span className="label">IGST ({igstRate}%)</span>
                    <span className="value">{formatINR(igstAmount)}</span>
                  </div>
                )
              )}
              <div className="totals-row total">
                <span>Total</span>
                <span>{formatINR(invoice.totalAmount)}</span>
              </div>
              <div className="totals-row paid">
                <span className="label">Paid</span>
                <span className="value">{formatINR(invoice.paidAmount)}</span>
              </div>
              <div className="totals-row balance">
                <span>Balance Due</span>
                <span
                  className={`value ${toNum(invoice.balanceDue) > 0 ? "due" : "clear"}`}
                >
                  {formatINR(invoice.balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || customTerms) && (
            <div className="notes-section">
              {invoice.notes && (
                <div style={{ marginBottom: "12px" }}>
                  <h4>Notes</h4>
                  <p>{invoice.notes}</p>
                </div>
              )}
              {customTerms && (
                <div>
                  <h4>Terms & Conditions</h4>
                  <p>{customTerms}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment terms — shown on the Proforma until full payment is received */}
          {!fullyPaid && (
            <div className="notes-section">
              <h4>Payment Terms</h4>
              <p>
                1. To block the slot — 20% on the day of booking.{"\n"}
                2. 60% — 15 days before the event.{"\n"}
                3. Balance (20%) — 2 hours before the event.{"\n"}
                {"\n"}
                This is a Proforma Invoice for advance/part payment and is not a tax
                document. A Tax Invoice will be issued once full payment is received.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            {fullyPaid
              ? "This is a computer-generated tax invoice and does not require a physical signature."
              : "This is a computer-generated proforma invoice and does not require a physical signature."}
          </div>
        </div>
      </body>
    </html>
  );
}
