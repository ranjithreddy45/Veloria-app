import { notFound } from "next/navigation";
import { format } from "date-fns";
import { getQuote } from "@/actions/quote.actions";
import { formatINR } from "@/lib/utils";
import { COMPANY_ADDRESS, COMPANY_GSTIN } from "@/lib/constants";

// ============================================================
// Print-Optimized Quote PDF Page
// ============================================================
// Opens in a new tab, styled for clean A4 printing/saving as PDF.
// No sidebar, no header — just the quote.

export const metadata = {
  title: "Quote PDF | Veloria Grand",
};

interface QuotePdfPageProps {
  params: Promise<{ quoteId: string }>;
}

function toNum(
  val: number | string | { toString(): string } | null | undefined
): number {
  if (val === null || val === undefined) return 0;
  return Number(val.toString());
}

export default async function QuotePdfPage({ params }: QuotePdfPageProps) {
  const { quoteId } = await params;
  const result = await getQuote(quoteId);

  if (!result.success || !result.data) {
    notFound();
  }

  const quote = result.data;
  const discountPercent = toNum(quote.discountPercent);
  const discountAmount = toNum(quote.discountAmount);
  const taxRate = toNum(quote.taxRate);
  const taxAmount = toNum(quote.taxAmount);

  return (
    <html lang="en">
      <head>
        <title>Quote {quote.quoteNumber} - Veloria Grand</title>
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
              .quote { max-width: 210mm; margin: 0 auto; padding: 40px; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; }
              .company h1 { font-size: 24px; font-weight: 700; color: #18181b; }
              .company p { font-size: 12px; color: #71717a; margin-top: 4px; }
              .quote-meta { text-align: right; }
              .quote-meta h2 { font-size: 20px; font-weight: 700; color: #18181b; }
              .quote-meta .number { font-size: 14px; font-weight: 500; margin-top: 4px; }
              .quote-meta .title { font-size: 13px; color: #52525b; margin-top: 2px; }
              .quote-meta .dates { margin-top: 8px; font-size: 12px; color: #52525b; }
              .quote-meta .dates span { font-weight: 500; }
              .status-badge {
                display: inline-block; margin-top: 8px; padding: 2px 10px;
                border-radius: 9999px; font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.5px;
              }
              .status-DRAFT { background: #f4f4f5; color: #71717a; }
              .status-SENT { background: #dbeafe; color: #1d4ed8; }
              .status-VIEWED { background: #cffafe; color: #0e7490; }
              .status-ACCEPTED { background: #dcfce7; color: #15803d; }
              .status-REJECTED { background: #fee2e2; color: #dc2626; }
              .status-EXPIRED { background: #f4f4f5; color: #71717a; }
              .status-CONVERTED { background: #f3e8ff; color: #7e22ce; }
              .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
              .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
              .section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #a1a1aa; margin-bottom: 8px; }
              .bill-to .name { font-weight: 600; font-size: 14px; }
              .bill-to .detail { font-size: 12px; color: #52525b; }
              .detail-row { font-size: 12px; margin-bottom: 4px; }
              .detail-row .label { color: #71717a; }
              .detail-row .value { font-weight: 500; }
              .cover-letter { margin-top: 24px; }
              .cover-letter p { font-size: 12px; color: #52525b; white-space: pre-line; }
              table { width: 100%; border-collapse: collapse; margin-top: 24px; }
              thead th { padding: 8px 0; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #71717a; border-bottom: 2px solid #e4e4e7; }
              thead th.right { text-align: right; }
              tbody td { padding: 10px 0; border-bottom: 1px solid #f4f4f5; font-size: 13px; }
              tbody td.right { text-align: right; }
              tbody td.bold { font-weight: 500; }
              tbody td.muted { color: #71717a; }
              .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
              .totals-table { width: 260px; }
              .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
              .totals-row .label { color: #71717a; }
              .totals-row .value { font-weight: 500; }
              .totals-row.discount .value { color: #dc2626; }
              .totals-row.total { font-size: 15px; font-weight: 700; border-top: 2px solid #e4e4e7; padding-top: 8px; margin-top: 4px; }
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
                .quote { padding: 0; }
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.onload = function() {
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
          <span>Quote {quote.quoteNumber} — Ready to save as PDF</span>
          <button id="print-btn">
            Save as PDF / Print
          </button>
        </div>

        <div className="quote" style={{ marginTop: "60px" }}>
          {/* Header */}
          <div className="header">
            <div className="company">
              <h1>Veloria Grand</h1>
              <p>Premium Event & Banquet Services</p>
              <p>
                {COMPANY_ADDRESS}
              </p>
            </div>
            <div className="quote-meta">
              <h2>QUOTATION</h2>
              <div className="number">{quote.quoteNumber}</div>
              <div className="title">{quote.title}</div>
              <div className="dates">
                <div>
                  <span>Date:</span>{" "}
                  {format(new Date(quote.createdAt), "dd MMM yyyy")}
                </div>
                <div>
                  <span>Valid Until:</span>{" "}
                  {format(new Date(quote.validUntil), "dd MMM yyyy")}
                </div>
              </div>
              <div className={`status-badge status-${quote.status}`}>
                {quote.status}
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* Prepared For & Details */}
          <div className="grid-2">
            <div className="bill-to">
              <div className="section-label">Prepared For</div>
              <div className="name">
                {quote.contact.firstName} {quote.contact.lastName}
              </div>
              {quote.contact.company && (
                <div className="detail">{quote.contact.company}</div>
              )}
              {quote.contact.address && (
                <div className="detail">
                  {quote.contact.address}
                  {quote.contact.city && `, ${quote.contact.city}`}
                  {quote.contact.state && `, ${quote.contact.state}`}
                  {quote.contact.pincode && ` - ${quote.contact.pincode}`}
                </div>
              )}
              {quote.contact.email && (
                <div className="detail">{quote.contact.email}</div>
              )}
              {quote.contact.phone && (
                <div className="detail">{quote.contact.phone}</div>
              )}
            </div>
            <div>
              <div className="section-label">Quote Details</div>
              {quote.lead && (
                <div className="detail-row">
                  <span className="label">Lead: </span>
                  <span className="value">{quote.lead.title}</span>
                </div>
              )}
              {quote.package && (
                <div className="detail-row">
                  <span className="label">Package: </span>
                  <span className="value">{quote.package.name}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="label">Prepared by: </span>
                <span className="value">
                  {quote.createdBy.name || "Unknown"}
                </span>
              </div>
            </div>
          </div>

          {/* Cover Letter */}
          {quote.coverLetter && (
            <div className="cover-letter">
              <div className="section-label">Cover Letter</div>
              <p>{quote.coverLetter}</p>
            </div>
          )}

          {/* Line Items Table */}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Category</th>
                <th className="right">Qty</th>
                <th className="right">Unit Price</th>
                <th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.lineItems.map(
                (
                  item: {
                    id: string;
                    description: string;
                    quantity: number | string | { toString(): string };
                    unitPrice: number | string | { toString(): string };
                    amount: number | string | { toString(): string };
                    category?: string | null;
                  },
                  index: number
                ) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td className="bold">{item.description}</td>
                    <td className="muted">{item.category || "--"}</td>
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
                <span className="value">{formatINR(quote.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="totals-row discount">
                  <span className="label">Discount ({discountPercent}%)</span>
                  <span className="value">-{formatINR(discountAmount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="totals-row">
                  <span className="label">Tax ({taxRate}%)</span>
                  <span className="value">{formatINR(taxAmount)}</span>
                </div>
              )}
              <div className="totals-row total">
                <span>Total</span>
                <span>{formatINR(quote.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(quote.notes || quote.terms) && (
            <div className="notes-section">
              {quote.notes && (
                <div style={{ marginBottom: "12px" }}>
                  <h4>Notes</h4>
                  <p>{quote.notes}</p>
                </div>
              )}
              {quote.terms && (
                <div>
                  <h4>Terms & Conditions</h4>
                  <p>{quote.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            This is a computer-generated quotation and does not require a
            physical signature.
          </div>
        </div>
      </body>
    </html>
  );
}
