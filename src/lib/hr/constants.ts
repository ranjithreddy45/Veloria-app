// ============================================================
// HR / People — shared constants, labels, and seed lists.
// ============================================================

import type { EmploymentType, EmployeeStatus } from "@prisma/client";

// --- Legal entities (admin-manageable; this is the initial seed) ---
// Nextura Ventures is a partnership firm → isIncorporated: false.
export const LEGAL_ENTITY_SEED = [
  { name: "DigiMark Online Services Pvt Ltd", shortCode: "DIGIMARK", isIncorporated: true, order: 1 },
  { name: "Billion Events Hospitality Services Pvt Ltd", shortCode: "BILLION", isIncorporated: true, order: 2 },
  { name: "Nestive Rental Services", shortCode: "NESTIVE", isIncorporated: true, order: 3 },
  { name: "Olive Hotels", shortCode: "OLIVE", isIncorporated: true, order: 4 },
  { name: "CSR Projects", shortCode: "CSR", isIncorporated: true, order: 5 },
  { name: "Nextura Ventures", shortCode: "NEXTURA", isIncorporated: false, order: 6 },
] as const;

// --- Business verticals (separate dimension from legal entity) ---
export const BUSINESS_VERTICAL_SEED = [
  { name: "Nestive (Rentals)", order: 1 },
  { name: "Veloria / Billion Events", order: 2 },
  { name: "PropertyPlush Commercial", order: 3 },
  { name: "Olive Hotels", order: 4 },
  { name: "CSR", order: 5 },
] as const;

export const DEPARTMENT_SEED = [
  "Leadership", "Human Resources", "Finance & Accounts", "Sales", "Business Development",
  "Operations", "Projects", "Marketing", "Technology", "Customer Experience", "Legal",
] as const;

export const DESIGNATION_SEED = [
  "Founder", "Director", "Head of Department", "Manager", "Assistant Manager",
  "Team Lead", "Senior Executive", "Executive", "Associate", "Intern",
] as const;

// --- Display labels ---
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERN: "Intern",
};

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  ONBOARDING: "Onboarding",
  ON_LEAVE: "On leave",
  EXITED: "Exited",
  SUSPENDED: "Suspended",
};

// StatusPill hue per status (tailwind color names accepted by StatusPill).
export const EMPLOYEE_STATUS_HUE: Record<EmployeeStatus, "emerald" | "sky" | "amber" | "slate" | "red"> = {
  ACTIVE: "emerald",
  ONBOARDING: "sky",
  ON_LEAVE: "amber",
  EXITED: "slate",
  SUSPENDED: "red",
};

export const GENDER_OPTIONS = ["Female", "Male", "Other", "Prefer not to say"] as const;

// Roles that can be assigned to a linked User when an employee is given app access.
export const HR_ROLE_LABELS: Record<string, string> = {
  HR_MANAGER: "HR Manager",
  HR_EXECUTIVE: "HR Executive",
  AUDITOR: "Auditor (read-only)",
};

// Build a display full name.
export function employeeName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

// --- Leave types (default seed; admin-editable) ---
export const LEAVE_TYPE_SEED = [
  { name: "Casual Leave", code: "CL", paid: true, accrualPerYear: 12, carryForwardMax: 0, allowHalfDay: true, allowNegative: false, requiresApproval: true, color: "blue", order: 1 },
  { name: "Sick Leave", code: "SL", paid: true, accrualPerYear: 12, carryForwardMax: 0, allowHalfDay: true, allowNegative: false, requiresApproval: true, color: "rose", order: 2 },
  { name: "Earned Leave", code: "EL", paid: true, accrualPerYear: 18, carryForwardMax: 30, allowHalfDay: true, allowNegative: false, requiresApproval: true, color: "emerald", order: 3 },
  { name: "Comp Off", code: "COMP", paid: true, accrualPerYear: 0, carryForwardMax: 0, allowHalfDay: true, allowNegative: false, requiresApproval: true, color: "violet", order: 4 },
  { name: "Maternity Leave", code: "ML", paid: true, accrualPerYear: 182, carryForwardMax: 0, allowHalfDay: false, allowNegative: false, requiresApproval: true, color: "pink", order: 5 },
  { name: "Loss of Pay", code: "LOP", paid: false, accrualPerYear: 0, carryForwardMax: 0, allowHalfDay: true, allowNegative: true, requiresApproval: true, color: "slate", order: 6 },
] as const;

// Fixed-date national / Karnataka holidays for 2026 (admin adds movable festivals).
export const HOLIDAY_SEED_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-05-01", name: "May Day" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-11-01", name: "Kannada Rajyotsava" },
  { date: "2026-12-25", name: "Christmas" },
] as const;

export const LEAVE_STATUS_HUE: Record<string, "amber" | "emerald" | "red" | "slate"> = {
  PENDING: "amber",
  APPROVED: "emerald",
  REJECTED: "red",
  CANCELLED: "slate",
};
export const LEAVE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled",
};

// Generate the next employee code given the current max numeric suffix.
// Format: PPG-0001 (PropertyPlush Group). Pure helper for testability.
export function nextEmpCode(existingCodes: string[]): string {
  let max = 0;
  for (const c of existingCodes) {
    const m = /(\d+)\s*$/.exec(c);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PPG-${String(max + 1).padStart(4, "0")}`;
}
