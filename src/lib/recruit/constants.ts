// Recruitment constants — plain module so they can be imported by both the
// "use server" actions file and client components (a "use server" file may only
// export async functions, so these can't live there).

export const REC_APP_STAGES = ["SCREENING", "SUBMISSIONS", "INTERVIEW", "OFFERED", "HIRED", "REJECTED", "ARCHIVED"] as const;
export const REC_CANDIDATE_STAGES = ["NEW", "IN_REVIEW", "AVAILABLE", "ENGAGED", "OFFERED", "HIRED", "REJECTED"] as const;
export const REC_JOB_STATUSES = ["IN_PROGRESS", "ON_HOLD", "INACTIVE", "FILLED", "CANCELLED"] as const;
