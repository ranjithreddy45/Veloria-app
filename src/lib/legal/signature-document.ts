// ============================================================
// Signature Document Renderer — frozen e-signature snapshot
// ------------------------------------------------------------
// Pure (no-IO) builder that produces the immutable HTML the signer
// reviews on the public /sign/<token> page. It mirrors the booking
// confirmation email markup (bookingConfirmationEmail) but is fully
// standalone — no portal CTA, no internal-only data — and embeds the
// canonical T&C via renderBookingTermsEmailHtml() so the locked
// document captures EXACTLY what was presented at send time.
//
// IMPORTANT (legal integrity): the string returned here is frozen
// into SignatureRequest.documentBody at create time and is NEVER
// re-rendered on the public page. If the T&C change afterwards the
// signer still signs the version captured here. The active
// BOOKING_TERMS_VERSION is re-exported so callers can record it.
//
// IMPORTANT (XSS): every dynamic string is passed through the local
// escapeHtml() before interpolation. documentBody is later rendered
// via dangerouslySetInnerHTML, so nothing dynamic may be injected
// unescaped. The signer's typed/drawn signature is never injected
// back into this document.
// ============================================================

import {
  renderBookingTermsEmailHtml,
  BOOKING_TERMS_VERSION,
} from "@/lib/legal/booking-terms";

// Re-export so the action that freezes the snapshot can stamp which
// terms version was signed onto the SignatureRequest metadata.
export { BOOKING_TERMS_VERSION };

const TIME_SLOT_LABELS: Record<string, string> = {
  MORNING: "Morning (8 AM – 12 PM)",
  AFTERNOON: "Afternoon (12 PM – 5 PM)",
  EVENING: "Evening (5 PM – 11 PM)",
  FULL_DAY: "Full Day (8 AM – 11 PM)",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SignatureDocumentData {
  contactName: string;
  bookingNumber: string;
  eventName: string;
  eventType: string;
  date: string; // pre-formatted date string
  timeSlot: string; // raw TimeSlot enum value
  venueName: string;
  guestCount: number;
  totalAmount: string; // pre-formatted INR string (formatINR)
  specialRequests?: string | null;
}

/**
 * Document title persisted on the SignatureRequest and shown on the
 * public sign page header.
 */
export function buildSignatureDocumentTitle(bookingNumber: string): string {
  return `Booking Confirmation & Terms — ${bookingNumber}`;
}

/**
 * Builds the frozen, self-contained HTML snapshot the signer reviews.
 * Pure function — no IO. All dynamic values are HTML-escaped.
 */
export function buildSignatureDocumentHtml(
  data: SignatureDocumentData
): string {
  const timeLabel = TIME_SLOT_LABELS[data.timeSlot] || data.timeSlot;

  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:6px 0;color:#64748b;font-size:13px;width:150px;vertical-align:top;">${escapeHtml(
        label
      )}</td>
      <td style="padding:6px 0;color:#18181b;font-size:13px;${
        strong ? "font-weight:700;" : "font-weight:500;"
      }">${value}</td>
    </tr>`;

  const specialRow = data.specialRequests
    ? `
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:13px;vertical-align:top;">Special Requests</td>
        <td style="padding:6px 0;color:#52525b;font-size:13px;">${escapeHtml(
          data.specialRequests
        )}</td>
      </tr>`
    : "";

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
    <tr>
      <td>
        <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px;border-radius:12px;text-align:center;">
          <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;">Veloria Grand</h1>
          <p style="color:#c7d2fe;font-size:13px;margin:6px 0 0;">Premium Event &amp; Banquet Services</p>
        </div>

        <h2 style="color:#18181b;font-size:18px;font-weight:700;margin:24px 0 6px;">Booking Confirmation</h2>
        <p style="color:#52525b;font-size:13.5px;line-height:1.6;margin:0 0 20px;">
          Dear ${escapeHtml(data.contactName)},<br/>
          Please review your booking details and the Terms &amp; Conditions below carefully, then sign to confirm your acceptance.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <tr>
            <td style="padding:18px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row("Booking Number", escapeHtml(data.bookingNumber), true)}
                ${row("Event", escapeHtml(data.eventName))}
                ${row("Type", escapeHtml(data.eventType))}
                ${row("Date", escapeHtml(data.date))}
                ${row("Time Slot", escapeHtml(timeLabel))}
                ${row("Venue", escapeHtml(data.venueName))}
                ${row("Guests", escapeHtml(String(data.guestCount)))}
                ${row("Total Amount", escapeHtml(data.totalAmount), true)}
                ${specialRow}
              </table>
            </td>
          </tr>
        </table>

        ${renderBookingTermsEmailHtml()}

        <p style="color:#71717a;font-size:12px;line-height:1.55;margin:24px 0 0;border-top:1px solid #e4e4e7;padding-top:16px;">
          By signing this document electronically you acknowledge that you have read, understood and agree to be bound by the Terms &amp; Conditions (v${escapeHtml(
            BOOKING_TERMS_VERSION
          )}) set out above for booking ${escapeHtml(
            data.bookingNumber
          )}. Your electronic signature, the time of signing and your device details are recorded for audit purposes and carry the same legal effect as a handwritten signature.
        </p>
      </td>
    </tr>
  </table>`.trim();
}
