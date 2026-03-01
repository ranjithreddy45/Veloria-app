// ============================================================
// Payment Received Email Template
// ============================================================

interface PaymentReceivedData {
  contactName: string;
  receiptNumber: string;
  invoiceNumber: string;
  paymentAmount: string; // formatted INR
  paymentMethod: string;
  paymentDate: string;
  remainingBalance: string; // formatted INR
  isFullyPaid: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE: "Cheque",
  UPI: "UPI",
  RAZORPAY: "Razorpay (Online)",
};

export function paymentReceivedEmail(data: PaymentReceivedData): string {
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal`;
  const methodLabel = METHOD_LABELS[data.paymentMethod] || data.paymentMethod;

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
            <td style="background:linear-gradient(135deg,#15803d,#16a34a);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;font-size:24px;font-weight:700;margin:0;">Veloria Grand</h1>
              <p style="color:#bbf7d0;font-size:14px;margin:8px 0 0;">Payment Received — Thank You!</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h2 style="color:#18181b;font-size:20px;font-weight:600;margin:0 0 8px;">
                ${data.isFullyPaid ? "Payment Complete!" : "Payment Received"}
              </h2>
              <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Dear ${data.contactName},<br/>
                ${data.isFullyPaid
                  ? "We've received your full payment. Your invoice is now marked as paid."
                  : "We've received your payment. Here's your receipt:"
                }
              </p>

              <!-- Payment Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;width:140px;">Receipt Number</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:600;">${data.receiptNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Invoice</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;">${data.invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Amount Paid</td>
                        <td style="padding:6px 0;color:#15803d;font-size:16px;font-weight:700;">${data.paymentAmount}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Payment Method</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;">${methodLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Date</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;">${data.paymentDate}</td>
                      </tr>
                      ${!data.isFullyPaid ? `
                      <tr>
                        <td style="padding:8px 0 0;border-top:1px solid #dcfce7;color:#64748b;font-size:13px;">Remaining Balance</td>
                        <td style="padding:8px 0 0;border-top:1px solid #dcfce7;color:#dc2626;font-size:14px;font-weight:600;">${data.remainingBalance}</td>
                      </tr>
                      ` : `
                      <tr>
                        <td style="padding:8px 0 0;border-top:1px solid #dcfce7;color:#64748b;font-size:13px;">Status</td>
                        <td style="padding:8px 0 0;border-top:1px solid #dcfce7;color:#15803d;font-size:14px;font-weight:700;">FULLY PAID</td>
                      </tr>
                      `}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <a href="${portalUrl}" style="display:inline-block;padding:12px 32px;background-color:#15803d;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                      View in Client Portal
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
