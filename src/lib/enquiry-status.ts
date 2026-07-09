// ============================================================
// Enquiry (WidgetInquiry) status constants + type.
// Kept in a plain module (NOT "use server") so that non-async values can be
// exported and imported by client components — a "use server" file may only
// export async functions, and exporting these consts from the action file
// breaks the Vercel build.
// ============================================================

export const ENQUIRY_STATUSES = ["INTERESTED", "DROPPED", "NO_RESPONSE"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const ENQUIRY_STATUS_LABEL: Record<EnquiryStatus, string> = {
  INTERESTED: "Interested",
  DROPPED: "Dropped",
  NO_RESPONSE: "No response",
};
