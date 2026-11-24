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
// A call that rang unanswered (missed-call rescue with status MISSED, or an
// IVR missed-call ping) is NOT a handled call: nobody has spoken to them, so
// those keep every alert.
// ============================================================

/** Push API source slugs whose leads come from a phone call the team handled. */
export const CALL_LEAD_SOURCES: ReadonlySet<string> = new Set(["callvibe"]);

export function isCallLeadSource(source: string | null | undefined): boolean {
  return !!source && CALL_LEAD_SOURCES.has(source.trim().toLowerCase());
}
