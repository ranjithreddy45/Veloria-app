import type { Hue } from "@/components/shared/status-pill";
import { REC_APP_STAGES, REC_CANDIDATE_STAGES } from "@/lib/recruit/constants";

// ============================================================
// Shared types + theming for the Candidate Detail screen.
// (Lives outside the "use server" actions file, which can only
// export async functions.)
// ============================================================

export type CandidateStage = (typeof REC_CANDIDATE_STAGES)[number];
export type AppStage = (typeof REC_APP_STAGES)[number];

export interface CandidateView {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  rating: number;
  stage: string;
  notes: string | null;
}

export interface ApplicationView {
  id: string;
  jobOpeningId: string;
  jobTitle: string;
  stage: string;
}

export interface InterviewView {
  id: string;
  applicationId: string | null;
  round: string;
  mode: string;
  scheduledAt: string;
  interviewerId: string | null;
  interviewerName: string | null;
  status: string;
  rating: number;
  feedback: string | null;
}

export interface OfferView {
  id: string;
  jobOpeningId: string | null;
  jobTitle: string | null;
  ctc: number;
  joiningDate: string | null;
  status: string;
  notes: string | null;
}

export interface JobOption {
  id: string;
  title: string;
}

// ---------- Candidate stage ----------
export const CANDIDATE_STAGE_HUE: Record<string, Hue> = {
  NEW: "slate",
  IN_REVIEW: "blue",
  AVAILABLE: "cyan",
  ENGAGED: "violet",
  OFFERED: "amber",
  HIRED: "emerald",
  REJECTED: "rose",
};
export const CANDIDATE_STAGE_LABEL: Record<string, string> = {
  NEW: "New",
  IN_REVIEW: "In Review",
  AVAILABLE: "Available",
  ENGAGED: "Engaged",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

// ---------- Application stage ----------
export const APP_STAGE_HUE: Record<string, Hue> = {
  SCREENING: "slate",
  SUBMISSIONS: "blue",
  INTERVIEW: "violet",
  OFFERED: "amber",
  HIRED: "emerald",
  REJECTED: "rose",
  ARCHIVED: "neutral",
};
export const APP_STAGE_LABEL: Record<string, string> = {
  SCREENING: "Screening",
  SUBMISSIONS: "Submissions",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
};

// ---------- Interview ----------
export const INTERVIEW_MODES = ["IN_PERSON", "VIDEO", "PHONE"] as const;
export const INTERVIEW_MODE_LABEL: Record<string, string> = {
  IN_PERSON: "In Person",
  VIDEO: "Video",
  PHONE: "Phone",
};

export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export const INTERVIEW_STATUS_HUE: Record<string, Hue> = {
  SCHEDULED: "blue",
  COMPLETED: "emerald",
  CANCELLED: "neutral",
  NO_SHOW: "rose",
};
export const INTERVIEW_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

// ---------- Offer ----------
export const OFFER_STATUS_HUE: Record<string, Hue> = {
  DRAFT: "slate",
  SENT: "blue",
  ACCEPTED: "emerald",
  DECLINED: "rose",
  WITHDRAWN: "neutral",
};
export const OFFER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

// ---------- Avatar tint ----------
const AVATAR_TINTS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-teal-100 text-teal-700",
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}
