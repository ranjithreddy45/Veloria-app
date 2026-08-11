// ============================================================
// WhatsApp template variables — named → positional mapping (authoritative)
// ------------------------------------------------------------
// Meta's WhatsApp Business API only supports POSITIONAL placeholders ({{1}},
// {{2}}, …); the app addresses templates with NAMED params (customerName, …).
// This single table is the source of truth for the ORDER each template's
// variables appear in the Meta-approved body, so the send path can map named →
// positional. Get the order wrong and a customer sees their event date where
// their name should be.
//
// Meta authoring rules the order must respect (enforced when templates are
// created in Weflux/Meta): body may not start or end with a variable; no two
// variables adjacent; variables numbered sequentially from {{1}} in ascending
// order of appearance.
// ============================================================

export const TEMPLATE_PARAM_ORDER: Record<string, string[]> = {
  booking_confirmation: ["customerName", "eventDate", "venueName"],
  review_request: ["customerName", "eventName", "reviewLink"],
  payment_reminder: ["customerName", "amount", "dueDate"],
  event_reminder: ["customerName", "eventDate", "eventTime"],
  thank_you: ["customerName", "eventType"],
  quote_sent: ["customerName", "quoteNumber"],
  guest_invitation: [
    "guestName",
    "eventName",
    "eventDate",
    "eventTime",
    "venueName",
    "hostName",
    "rsvpLink",
  ],
  save_the_date: ["guestName", "eventName", "eventDate", "venueName", "daysUntil"],
  // daysUntil is position 4 (ascending order of appearance in the Meta body).
  excitement_builder: ["guestName", "eventName", "eventDate", "daysUntil"],
  final_countdown: ["guestName", "eventName", "eventDate", "eventTime", "venueName"],
  tomorrow_reminder: ["guestName", "eventName", "eventTime", "venueName", "dressCode"],
  day_of_welcome: ["guestName", "eventName", "eventTime", "venueName", "parkingInfo"],
};

/**
 * Convert a caller's NAMED params to positional values in the template's
 * authoritative order. Returns both an object keyed "1","2",… and a plain array
 * so the send layer can use whichever shape the provider expects. Unknown
 * templates fall back to the object's own key order (best-effort).
 */
export function toPositionalVars(
  templateName: string,
  params?: Record<string, string>
): { object: Record<string, string>; array: string[] } {
  if (!params) return { object: {}, array: [] };
  const order = TEMPLATE_PARAM_ORDER[templateName];
  const keys = order && order.length ? order : Object.keys(params);
  const array: string[] = [];
  const object: Record<string, string> = {};
  keys.forEach((k, i) => {
    const v = params[k];
    if (v !== undefined && v !== null) {
      array.push(String(v));
      object[String(i + 1)] = String(v);
    }
  });
  return { object, array };
}
