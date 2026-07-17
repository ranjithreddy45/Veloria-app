// ============================================================
// Enquiry (WidgetInquiry) status constants + type.
// Kept in a plain module (NOT "use server") so that non-async values can be
// exported and imported by client components — a "use server" file may only
// export async functions, and exporting these consts from the action file
// breaks the Vercel build.
// ============================================================

// LEAD_CREATED completes the founder's 4-value vocabulary and matches the
// Contact-side `enquiryStatus` on /contacts, so both enquiry surfaces speak the
// same language. Stored as a plain String column — no enum migration needed.
export const ENQUIRY_STATUSES = ["LEAD_CREATED", "INTERESTED", "DROPPED", "NO_RESPONSE"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  LEAD_CREATED: "Lead created",
  INTERESTED: "Interested",
  DROPPED: "Dropped",
  NO_RESPONSE: "No response",
};
