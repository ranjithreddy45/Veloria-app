// ============================================================
// Consent wording — the exact sentences a person ticks on a public form.
// ------------------------------------------------------------
// Plain module (no server-only imports) so BOTH the client checkbox and the
// server-side ConsentRecord write read the same string. If the wording ever
// changes, older ConsentRecord rows keep the sentence that was actually
// shown at the time — that is the evidence the DPDP Act asks for.
// ============================================================

export const PRIVACY_POLICY_PATH = "/privacy";

/** Default wording for enquiry-type forms (webform, landing page, widget, visit, hold). */
export const CONSENT_TEXT_ENQUIRY =
  "I agree to Veloria Grand storing my details to respond to this enquiry — see Privacy Policy";

/** RSVP: the guest's response is shared with the hosts of that one event. */
export const CONSENT_TEXT_RSVP =
  "I agree to Veloria Grand storing my RSVP details and sharing them with my hosts for this event — see Privacy Policy";

/** Careers: the applicant's details are kept to consider the application. */
export const CONSENT_TEXT_CAREERS =
  "I agree to Veloria Grand storing my details to consider my application — see Privacy Policy";

/** Guest draw: mirrors the wording already shown on /draw (WhatsApp contact). */
export const CONSENT_TEXT_DRAW =
  "I agree that Veloria Grand may contact me on WhatsApp about the draw result and future offers. I can opt out anytime. — see Privacy Policy";

export type ConsentPurpose =
  | "ENQUIRY_RESPONSE"
  | "RSVP"
  | "SITE_VISIT"
  | "DATE_HOLD"
  | "JOB_APPLICATION"
  | "DRAW_WHATSAPP";

export type ConsentSubjectType = "CONTACT" | "GUEST" | "CANDIDATE" | "EMPLOYEE";
