// ============================================================
// Booking Terms & Conditions — single source of truth
// ------------------------------------------------------------
// Canonical Veloria Grand booking T&C, transcribed from the official Booking
// Confirmation template. Rendered into the confirmation email, the client
// portal booking view, and the internal booking detail page so the wording
// stays identical everywhere. Update here and it propagates to all surfaces.
// ============================================================

export interface TermsSection {
  id: string;
  icon: string; // emoji marker (renders in email + UI)
  title: string;
  items: string[];
}

export const BOOKING_TERMS_VERSION = "2026.1";

export const BOOKING_TERMS: TermsSection[] = [
  {
    id: "cancellation",
    icon: "🚫",
    title: "Cancellation Policy",
    items: [
      "Cancellation requests must be made in writing via email to bookings@veloriagrand.com and are effective only upon written acknowledgement from Veloria Grand.",
      "60 or more days before the event: 80% of the advance (Stage 1) will be refunded. The remaining 20% of the advance is non-refundable as a booking processing fee.",
      "30–59 days before the event: 50% of the total amount paid to date will be refunded. The balance is forfeited.",
      "15–29 days before the event: 25% of the total amount paid to date will be refunded.",
      "Less than 15 days before the event: No refund will be issued. The full booking value remains payable as a cancellation fee, regardless of amounts paid.",
      "In the event of a government-mandated lockdown, force majeure, or natural disaster, Veloria Grand will offer a full credit note valid for 12 months — no cash refund.",
      "Any partial cancellation of services (e.g. removing photography, reducing add-ons) must be made at least 7 working days before the event.",
    ],
  },
  {
    id: "rescheduling",
    icon: "📅",
    title: "Event Date Shifting / Rescheduling",
    items: [
      "Date shift requests are subject to hall availability on the requested date. Veloria Grand does not guarantee availability for alternate dates.",
      "First date shift: Complimentary if requested 30 or more days before the original event date. A fee of ₹5,000 applies if requested between 15–29 days prior.",
      "Second date shift: An administration fee of ₹10,000 applies regardless of notice period. No further shifts will be permitted thereafter.",
      "If the rescheduled date falls in a higher-pricing season (October–February wedding season, public holidays), the difference in package pricing will be charged additionally.",
      "Date shift requests made less than 15 days before the event will be treated as a cancellation with a new booking — the cancellation policy applies.",
      "Veloria Grand reserves the right to reschedule an event in exceptional circumstances (structural emergency, force majeure). A full credit note or refund will be issued.",
    ],
  },
  {
    id: "guest-count",
    icon: "👥",
    title: "Changes to Guest / Attendee Count",
    items: [
      "The confirmed guest count determines F&B quantities, seating layout, and vendor commitments.",
      "Any increase in the number of attendees must be communicated to your Event Manager at least 24 hours before the event commencement time, without exception.",
      "Guest count can be increased up to a maximum of 10% above the confirmed count, subject to hall capacity and F&B availability.",
      "Additional guests added within the 24-hour window will be charged at 1.5× the standard per-head rate for the confirmed package, payable immediately.",
      "Reductions in guest count of more than 10% within 7 days of the event will still be charged at the original confirmed pax count for F&B purposes.",
      "Veloria Grand reserves the right to refuse entry to guests beyond the hall's licensed capacity, regardless of the host's instructions, as per safety regulations.",
    ],
  },
  {
    id: "general",
    icon: "📋",
    title: "General Terms",
    items: [
      "Venue access is granted 30–45 minutes before the event start time for guest arrival management. Setup access for decorators must be pre-arranged with the Event Manager.",
      "Outside food and beverages are strictly not permitted unless explicitly approved by Veloria Grand management in writing. A fee may apply for approved outside items.",
      "Outside decorators are permitted only with prior written permission and must comply with Veloria Grand's décor guidelines.",
      "Noise levels must comply with Bengaluru Noise Pollution Control Guidelines. Music must cease by 10:00 PM on weekdays and 11:00 PM on weekends/public holidays.",
      "Alcohol service is permitted only with a valid permit and only from Veloria Grand's empanelled bar partner. Outside alcohol is not permitted.",
      "Veloria Grand is a non-smoking premises. A designated smoking area is available outside.",
      "The host is responsible for the conduct of their guests. Any damage to venue property caused by guests will be assessed and billed to the host post-event.",
      "A refundable security deposit is held against property damage and refunded within 7 working days after the event, subject to post-event venue inspection.",
      "Veloria Grand is not responsible for loss of personal valuables, jewellery, electronics, or gifts at the venue.",
    ],
  },
  {
    id: "power",
    icon: "⚡",
    title: "Power, Technical & Infrastructure",
    items: [
      "Veloria Grand maintains a generator backup for all essential services including lighting, AC, and AV. Brief interruptions of 30–60 seconds during changeover are normal.",
      "In the event of a prolonged power outage beyond generator capacity, no refund or compensation will be issued for delays caused by government power failures.",
      "AV and sound equipment are tested before each event. A technical pre-check must be scheduled at least 48 hours before the event if external AV performers are brought.",
      "Air conditioning is maintained per venue standards. AC adjustments must be requested through the assigned Event Manager, not directly with technical staff.",
    ],
  },
  {
    id: "fnb",
    icon: "🍽️",
    title: "Food, Beverage & Service",
    items: [
      "F&B serving times are coordinated based on the confirmed run-of-show. Host-side program delays may result in food quality variation for hot items.",
      "Veloria Grand maintains FSSAI-compliant food hygiene standards. Guests with known allergies must inform the Event Manager at least 48 hours in advance.",
      "Leftover food cannot be taken home by guests or the host as per FSSAI regulations. Surplus food is donated to approved NGO food programmes.",
      "Veloria Grand is not liable for adverse reactions arising from food brought by guests from outside the venue.",
      "Live counters are available for a fixed serving window as confirmed in your package. Extensions are charged per hour, per counter, at the prevailing rate.",
    ],
  },
  {
    id: "parking",
    icon: "🚗",
    title: "Parking & Valet",
    items: [
      "Veloria Grand provides complimentary valet parking up to the vehicle count included in your package. Additional vehicles will be parked in the overflow area.",
      "Vehicle keys are held by the valet team during the event and returned at exit. Veloria Grand is not liable for damage to vehicles unless caused directly by staff.",
      "Oversized vehicles (buses, luxury coaches for baraats) must be pre-intimated at least 48 hours before the event.",
    ],
  },
  {
    id: "safety",
    icon: "🏥",
    title: "Health, Safety & Emergency",
    items: [
      "A trained first-aider is present at all events. In case of a medical emergency, Veloria Grand will immediately contact emergency services.",
      "Veloria Grand has a fire evacuation plan in place. All emergency exits are clearly marked. Guests must not block or tamper with emergency exits.",
      "Children below the age of 12 must be accompanied by an adult at all times within the venue premises.",
      "Veloria Grand does not permit entry to individuals who appear visibly intoxicated. Staff are trained to refuse alcohol service and this decision is final.",
    ],
  },
  {
    id: "privacy",
    icon: "📸",
    title: "Photography, Privacy & Social Media",
    items: [
      "Event photos taken by Veloria Grand's empanelled photographers may be used for portfolio and marketing materials unless you explicitly request otherwise in writing before the event.",
      "Third-party photography and videography are permitted for personal use. Commercial shoots require separate written permission from Veloria Grand management.",
      "Veloria Grand CCTV footage is retained for 30 days and may be shared with law enforcement on lawful request only.",
    ],
  },
  {
    id: "disputes",
    icon: "⚖️",
    title: "Dispute Resolution & Governing Law",
    items: [
      "Any disputes shall first be attempted to be resolved through direct discussion with Veloria Grand's General Manager.",
      "If unresolved within 15 working days, disputes shall be referred to mediation. If mediation fails, the matter shall be subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka.",
      "This booking confirmation, along with the signed Event Agreement, constitutes the complete and binding contract between the host and Veloria Grand Banquets.",
    ],
  },
];

// Condensed key terms for documents issued BEFORE confirmation (e.g. the
// quotation), where the full T&C would be excessive. The complete terms travel
// with the booking confirmation.
export const BOOKING_TERMS_KEY: string[] = [
  "Cancellation: 60+ days before — 80% of advance refunded; 30–59 days — 50% of amount paid; 15–29 days — 25%; under 15 days — non-refundable. Force majeure → 12-month credit note.",
  "Rescheduling: subject to hall availability. First date shift free if 30+ days prior (₹5,000 if 15–29 days); second shift ₹10,000. Under 15 days is treated as a cancellation.",
  "Guest count: the confirmed pax drives F&B, seating and vendor commitments. Increases must be advised at least 24 hours prior (max +10%); late additions are charged at 1.5× the per-head rate.",
  "Outside food, décor and alcohol require prior written approval. Music must cease by 10 PM (weekdays) / 11 PM (weekends). Full Terms & Conditions are provided with your Booking Confirmation.",
];

// Renderer for the quotation PDF (matches its `.terms` paragraph style).
export function renderBookingTermsQuoteHtml(): string {
  return `<h2>Terms &amp; Conditions</h2><p class="terms">${BOOKING_TERMS_KEY.map(
    (t, i) => `${i + 1}. ${escapeHtml(t)}`
  ).join("<br/>")}</p>`;
}

// Short summary line for SMS / WhatsApp where the full text is impractical.
export const BOOKING_TERMS_SHORT =
  "Your booking is subject to Veloria Grand's Terms & Conditions (cancellation, rescheduling, guest-count, and venue policies). Full terms are included in your booking confirmation email.";

// ------------------------------------------------------------
// Email renderer — returns an HTML fragment for the confirmation email.
// ------------------------------------------------------------
export function renderBookingTermsEmailHtml(): string {
  const sections = BOOKING_TERMS.map(
    (s) => `
      <tr><td style="padding:16px 0 4px;">
        <p style="margin:0;color:#18181b;font-size:14px;font-weight:700;">${s.icon} ${s.title}</p>
      </td></tr>
      <tr><td style="padding:0 0 4px;">
        <ul style="margin:0;padding-left:18px;color:#52525b;font-size:12.5px;line-height:1.55;">
          ${s.items.map((it) => `<li style="margin:0 0 5px;">${escapeHtml(it)}</li>`).join("")}
        </ul>
      </td></tr>`
  ).join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e4e4e7;">
    <tr><td style="padding:24px 0 4px;">
      <h3 style="margin:0;color:#18181b;font-size:16px;font-weight:700;">Terms &amp; Conditions</h3>
      <p style="margin:6px 0 0;color:#71717a;font-size:12px;">Please read carefully and retain this confirmation for your reference. Booking is subject to the following terms (v${BOOKING_TERMS_VERSION}).</p>
    </td></tr>
    ${sections}
  </table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
