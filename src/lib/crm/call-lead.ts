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
