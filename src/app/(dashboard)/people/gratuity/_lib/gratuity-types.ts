// ============================================================
// Gratuity module — shared types (PLAIN module, no "use server").
// These cross the server action ⇄ client component boundary, so they live
// here rather than in the "use server" action file (whose exports must be
// async functions only).
// ============================================================

/** Format a number as whole-rupee INR — the app's canonical money format. */
export function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Employee-status → StatusPill hue. Kept small; unknowns fall back to slate. */
export const EMP_STATUS_HUE: Record<string, "emerald" | "amber" | "slate" | "red" | "rose"> = {
  ACTIVE: "emerald",
  ONBOARDING: "amber",
  ON_LEAVE: "amber",
  EXITED: "slate",
  SUSPENDED: "red",
};

/** One employee row in the gratuity ledger / report. */
export interface GratuityRow {
  id: string;
  empCode: string;
  name: string;
  status: string;
  /** ISO date (yyyy-mm-dd) — computed in UTC — or null when not on record. */
  doj: string | null;
  /** Completed years of service to 2dp (0 when no DOJ). */
  yearsOfService: number;
  /** years >= gratuityMinYears (statutory 5). */
  eligible: boolean;
  /**
   * Last drawn monthly BASIC from the employee's current salary structure.
   * `null` = the employee has no current HrSalaryStructure — such an employee
   * is shown with "—" and EXCLUDED from any payable total.
   */
  lastBasic: number | null;
  /**
   * Projected statutory gratuity payout today via gratuityPayout(...).
   * `null` when there is no salary structure (cannot be computed / excluded).
   */
  projectedPayout: number | null;
  /** Sum of every HrPayslip.gratuityAccrued booked for this employee (cost). */
  accruedToDate: number;
}

/** Input for recording a manual gratuity settlement / override. */
export interface RecordGratuityInput {
  employeeId: string;
  settlementDate: string; // yyyy-mm-dd
  amount: number;
  note?: string;
}

/** A previously-recorded manual settlement (reconstructed from ActivityLog). */
export interface GratuitySettlementLog {
  id: string;
  employeeId: string;
  empCode: string;
  name: string;
  amount: number;
  settlementDate: string;
  note: string | null;
  recordedAt: string; // ISO
}
