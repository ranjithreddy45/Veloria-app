// ============================================================
// Feature flags — every module can be toggled independently.
// Disabling one must never break another. Flags are read from
// env (NEXT_PUBLIC_* so they work in both server & client) with
// a safe default. No flag gates multi-entity — that is always on.
// ============================================================

function flag(envValue: string | undefined, defaultOn: boolean): boolean {
  if (envValue === undefined || envValue === "") return defaultOn;
  return envValue === "1" || envValue.toLowerCase() === "true";
}

export const FEATURES = {
  // HR / People platform — P0 modules
  hr: flag(process.env.NEXT_PUBLIC_FEATURE_HR, true),
  hrLeave: flag(process.env.NEXT_PUBLIC_FEATURE_HR_LEAVE, true),
  hrAttendance: flag(process.env.NEXT_PUBLIC_FEATURE_HR_ATTENDANCE, true),
  hrDocuments: flag(process.env.NEXT_PUBLIC_FEATURE_HR_DOCUMENTS, true),
  hrOnboarding: flag(process.env.NEXT_PUBLIC_FEATURE_HR_ONBOARDING, true),
  // HR P1
  hrPerformance: flag(process.env.NEXT_PUBLIC_FEATURE_HR_PERFORMANCE, true),
  hrHelpdesk: flag(process.env.NEXT_PUBLIC_FEATURE_HR_HELPDESK, true),
  hrShifts: flag(process.env.NEXT_PUBLIC_FEATURE_HR_SHIFTS, true),
  hrAnalytics: flag(process.env.NEXT_PUBLIC_FEATURE_HR_ANALYTICS, true),
  // HR payroll & compensation (Wave 1) — salary structures, payslips, FnF.
  hrPayroll: flag(process.env.NEXT_PUBLIC_FEATURE_HR_PAYROLL, true),
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key];
}
