// ============================================================
// Vendor engagement Terms & Conditions — acknowledged by a vendor on the public
// confirm page before they can accept an event assignment. Edit the wording /
// bump VENDOR_TERMS_VERSION when the terms change (the accepted version is
// recorded per acknowledgement).
// ============================================================

export const VENDOR_TERMS_VERSION = "2026.1";

export const VENDOR_TERMS: { heading: string; points: string[] }[] = [
  {
    heading: "Commitment & attendance",
    points: [
      "By confirming, you commit to delivering the agreed services for this event on the stated date and time slot.",
      "You will arrive by the agreed arrival/setup time and complete teardown within the agreed window.",
      "A confirmed assignment cannot be cancelled within 72 hours of the event except in a documented emergency; late withdrawal may affect future engagements and empanelment status.",
    ],
  },
  {
    heading: "Scope, quality & conduct",
    points: [
      "Services, quantities and inclusions are as per the agreed package/quotation; any change must be approved in writing by Veloria Grand.",
      "Your team will maintain professional conduct, follow venue safety and access rules, and carry valid identification.",
      "You are responsible for your own equipment, licences, statutory compliances, and the conduct of your personnel.",
    ],
  },
  {
    heading: "Payment & liability",
    points: [
      "Payment is against the agreed rate and terms; advances (if any) are adjusted against the final settlement.",
      "You indemnify Veloria Grand against any claim arising from your services, personnel, or equipment.",
      "Veloria Grand is not liable for delays or losses caused by force majeure or the client's changes on the event day.",
    ],
  },
];

/** Flatten to plain text (for emails / audit). */
export function vendorTermsText(): string {
  return VENDOR_TERMS.map((s) => `${s.heading}\n${s.points.map((p) => `• ${p}`).join("\n")}`).join("\n\n");
}
