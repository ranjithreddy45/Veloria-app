// ============================================================
// Booking Confirmation Email Template
// ============================================================

import { renderBookingTermsEmailHtml } from "@/lib/legal/booking-terms";

interface BookingConfirmationData {
  contactName: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: string; // formatted date string
  timeSlot: string;
  venueName: string;
  guestCount: number;
  totalAmount: string; // formatted INR string
  specialRequests?: string | null;
}

const TIME_SLOT_LABELS: Record<string, string> = {
  MORNING: "Morning (8 AM – 12 PM)",
  AFTERNOON: "Afternoon (12 PM – 5 PM)",
  EVENING: "Evening (5 PM – 11 PM)",
  FULL_DAY: "Full Day (8 AM – 11 PM)",
};

export function bookingConfirmationEmail(data: BookingConfirmationData): string {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const timeLabel = TIME_SLOT_LABELS[data.timeSlot] || data.timeSlot;

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
              <h2 style="color:#18181b;font-size:20px;font-weight:600;margin:0 0 8px;">Booking Confirmed!</h2>
              <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Dear ${data.contactName},<br/>
                Your booking has been confirmed. Here are the details:
              </p>

              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;width:140px;">Booking Number</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:600;">${data.bookingNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Event</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:500;">${data.eventName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Type</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;">${data.eventType}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Date</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:500;">${data.date}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Time Slot</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;">${timeLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Venue</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;font-weight:500;">${data.venueName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Guests</td>
                        <td style="padding:6px 0;color:#18181b;font-size:13px;">${data.guestCount}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;">Total Amount</td>
                        <td style="padding:6px 0;color:#18181b;font-size:15px;font-weight:700;">${data.totalAmount}</td>
                      </tr>
                      ${data.specialRequests ? `
                      <tr>
                        <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Special Requests</td>
                        <td style="padding:6px 0;color:#52525b;font-size:13px;">${data.specialRequests}</td>
                      </tr>
                      ` : ""}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <a href="${portalUrl}/portal" style="display:inline-block;padding:12px 32px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
                      View in Client Portal
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Terms & Conditions -->
              ${renderBookingTermsEmailHtml()}
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
