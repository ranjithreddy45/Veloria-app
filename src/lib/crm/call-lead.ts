// ============================================================
// Leads made from a phone call.
//
// CallVibe creates a lead (Push API source "callvibe") when a call happens
// with a number we hold no lead for, so a rep has usually just spoken to
// that person, or dialled them. Alerting the team about it ("new lead", "first
// response overdue", "needs a manager") is noise: in 14 days of Nov 2026 those
// leads raised ~3,500 SLA alerts. A call lead is created quietly instead: no
// first-response clock, no "lead assigned" notice, no new-lead group email,
// no "call within 15 minutes" task. Customer-facing messages are unchanged.
//
// A call nobody handled keeps every alert: an inbound ring that didn't connect
// (the call-activity push decides from the call's direction and status), a
// CallVibe sync ring that wasn't ANSWERED, and any IVR provider's call (its
// "answered" may be the IVR menu). Leads CallVibe pushes straight to
// /api/v1/push/leads carry no call status, so those follow the owner's rule:
// a rep has spoken to them.
// ============================================================

/** Push API source slugs whose leads come from a phone call the team handled. */
export const CALL_LEAD_SOURCES: ReadonlySet<string> = new Set(["callvibe"]);

export function isCallLeadSource(source: string | null | undefined): boolean {
  return !!source && CALL_LEAD_SOURCES.has(source.trim().toLowerCase());
}

// ------------------------------------------------------------
// No email or WhatsApp for any phone lead (owner, 24 Nov 2026).
//
// "These are already called": every Phone Inquiry lead has been on the phone
// with the team, missed rings included (CallVibe follows those up). So the
// two staff emails and the WhatsApp ping never go out for a phone lead: the
// new-lead group email, and the "new lead assigned to you" email + WhatsApp.
// The in-app bell stays, and a missed ring keeps its first-response clock, so
// an unanswered caller still surfaces in the app.
// ------------------------------------------------------------

/** The lead source every phone call lead is stored under. */
export const PHONE_LEAD_SOURCE = "PHONE_INQUIRY";

export function isPhoneLead(source: string | null | undefined): boolean {
  return source === PHONE_LEAD_SOURCE;
}
