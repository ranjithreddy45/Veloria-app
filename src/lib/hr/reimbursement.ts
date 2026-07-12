// Shared reimbursement constants. Kept OUT of the "use server" actions file — a
// "use server" module may only export async functions, so a value export like this
// there breaks the Next.js build (caught only by a full `next build`, not by tsc).

export const REIMBURSEMENT_CATEGORIES = ["TRAVEL", "MEDICAL", "TELEPHONE", "FUEL", "BOOKS", "OTHER"] as const;
export type ReimbursementCategory = (typeof REIMBURSEMENT_CATEGORIES)[number];
