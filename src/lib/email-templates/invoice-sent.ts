// ============================================================
// Invoice Sent Email Template
// ============================================================

interface InvoiceSentData {
  contactName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string; // formatted INR
  lineItems: { description: string; amount: string }[];
  portalLink?: string;
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function invoiceSentEmail(data: InvoiceSentData): string {
  const portalUrl = data.portalLink || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal`;

  const lineItemRows = data.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;color:#18181b;font-size:13px;">${escapeHtml(item.description)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f4f4f5;color:#18181b;font-size:13px;text-align:right;font-weight:500;">${item.amount}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">Veloria Grand</h1>
              <p style="color:#c7d2fe;font-size:14px;margin:8px 0 0;">Premium Event & Banquet Services</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="color:#18181b;font-size:20px;font-weight:600;margin:0 0 8px;">Invoice ${escapeHtml(data.invoiceNumber)}</h2>
              <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Dear ${escapeHtml(data.contactName)},<br/>
                Please find your invoice details below. Payment is due by <strong>${data.dueDate}</strong>.
              </p>

              <!-- Invoice Summary -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:16px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color:#64748b;font-size:13px;">Invoice Number</td>
                        <td style="color:#18181b;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(data.invoiceNumber)}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-size:13px;padding-top:6px;">Issue Date</td>
                        <td style="color:#18181b;font-size:13px;text-align:right;padding-top:6px;">${data.issueDate}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-size:13px;padding-top:6px;">Due Date</td>
                        <td style="color:#dc2626;font-size:13px;font-weight:600;text-align:right;padding-top:6px;">${data.dueDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Line Items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px;">
                <tr>
                  <td style="padding:10px 12px;background-color:#f8fafc;border-bottom:2px solid #e2e8f0;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Description</td>
                  <td style="padding:10px 12px;background-color:#f8fafc;border-bottom:2px solid #e2e8f0;color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:right;">Amount</td>
                </tr>
                ${lineItemRows}
              </table>

              <!-- Total -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td align="right">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:8px 16px;color:#18181b;font-size:16px;font-weight:700;">Total Due:</td>
                        <td style="padding:8px 16px;color:#18181b;font-size:18px;font-weight:700;">${data.totalAmount}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <a href="${portalUrl}" style="display:inline-block;padding:12px 32px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                      View & Pay Online
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="color:#a1a1aa;font-size:12px;margin:0;">
                Veloria Grand — 123 Celebration Avenue, Event City, Karnataka 560001
              </p>
              <p style="color:#a1a1aa;font-size:11px;margin:8px 0 0;">
                This is an automated message. Please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
