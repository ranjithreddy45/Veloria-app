// ============================================================
// Two-factor authentication policy — pure constants, no imports.
// ------------------------------------------------------------
// Imported by auth.config.ts (edge middleware) and by dashboard UI, so this
// file must stay free of Prisma / Node-only modules.
// ============================================================

/** Roles that must enrol an authenticator app. */
export const REQUIRED_2FA_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
  "HR_MANAGER",
] as const;

/**
 * "soft"  — required roles see a dismissable banner until they enrol (default;
 *           never locks the owner out).
 * "hard"  — required roles without 2FA are redirected to /me/security from
 *           every other route by the `authorized` callback in auth.config.ts.
 * Flip to "hard" only once every REQUIRED_2FA_ROLES account has enrolled.
 */
export const TWO_FACTOR_ENFORCEMENT: "soft" | "hard" = "soft";

/** Self-service enrolment page reachable by every staff role. */
export const TWO_FACTOR_SETUP_PATH = "/me/security";

/** Second-step page for sessions that still owe a code (Google / WhatsApp). */
export const TWO_FACTOR_CHALLENGE_PATH = "/two-factor";

/** Paths a not-yet-enrolled required-role user may still visit under "hard". */
export const TWO_FACTOR_HARD_ALLOWLIST = [
  TWO_FACTOR_SETUP_PATH,
  "/settings/security",
  TWO_FACTOR_CHALLENGE_PATH,
  "/sign-in",
  "/sign-up",
  "/not-authorized",
] as const;

export function isTwoFactorRequiredForRole(role: string | null | undefined): boolean {
  return !!role && (REQUIRED_2FA_ROLES as readonly string[]).includes(role);
}
