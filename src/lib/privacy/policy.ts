// ============================================================
// Privacy policy facts — one place for the numbers and names the public
// /privacy page prints, so the policy and the retention crons can never
// disagree. Plain module: safe to import from server components.
// ============================================================

/** Retention defaults, stated on the policy page. Change here, not in copy. */
export const RETENTION_DEFAULTS = {
  /** Enquiries and leads that never became a booking. */
  enquiriesMonthsAfterLastActivity: 24,
  /** Bookings, invoices, payments, receipts — Indian tax/GST record-keeping. */
  bookingsYears: 8,
  /** Guest lists, RSVPs and invitations uploaded by a host. */
  guestListsMonthsAfterEvent: 12,
  /** Job applications that did not lead to a hire. */
  jobApplicationsMonths: 12,
} as const;

export interface GrievanceOfficer {
  name: string;
  email: string;
}

/**
 * Grievance Officer contact, from env with sensible fallbacks. DPDP requires a
 * named point of contact; the fallback name makes it obvious in the UI that
 * the env var has not been set yet.
 */
export function grievanceOfficer(): GrievanceOfficer {
  const name = (process.env.PRIVACY_OFFICER_NAME || "").trim() || "Grievance Officer, Billion Events";
  const email =
    (process.env.PRIVACY_OFFICER_EMAIL || "").trim() ||
    (process.env.NEXT_PUBLIC_COMPANY_EMAIL || "").trim() ||
    "privacy@theveloriagrand.com";
  return { name, email };
}

export const PRIVACY_REQUEST_KINDS = ["ACCESS", "DELETE", "CORRECT"] as const;
export type PrivacyRequestKind = (typeof PRIVACY_REQUEST_KINDS)[number];

export const PRIVACY_REQUEST_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "REJECTED"] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

export const PRIVACY_REQUEST_KIND_LABEL: Record<PrivacyRequestKind, string> = {
  ACCESS: "Access my data",
  DELETE: "Erase my data",
  CORRECT: "Correct my data",
};

export const PRIVACY_REQUEST_STATUS_LABEL: Record<PrivacyRequestStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  REJECTED: "Rejected",
};
