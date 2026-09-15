// ============================================================
// Distinguishable sign-in errors for the second factor.
// ------------------------------------------------------------
// Thrown from the credentials `authorize` in auth.ts. NextAuth re-throws
// CredentialsSignin subclasses out of the server-side signIn() call (raw mode),
// so signInAction can read `.code` and tell the sign-in form what to show.
// In redirect flows the code lands in `?code=` — nothing here is sensitive.
// ============================================================

import { CredentialsSignin } from "next-auth";

export const TWO_FACTOR_ERROR_CODES = {
  /** Password was correct; this account needs a 6-digit / recovery code too. */
  REQUIRED: "2FA_REQUIRED",
  /** A code was supplied but did not verify. */
  INVALID: "2FA_INVALID",
  /** Same as INVALID, but the code was a valid TOTP that had already been used. */
  REUSED: "2FA_REUSED",
  /** More than the allowed attempts inside the window. */
  RATE_LIMITED: "2FA_RATE_LIMITED",
} as const;

export type TwoFactorErrorCode =
  (typeof TWO_FACTOR_ERROR_CODES)[keyof typeof TWO_FACTOR_ERROR_CODES];

export class TwoFactorRequiredError extends CredentialsSignin {
  code: string = TWO_FACTOR_ERROR_CODES.REQUIRED;
}

export class TwoFactorInvalidError extends CredentialsSignin {
  code: string = TWO_FACTOR_ERROR_CODES.INVALID;
}

export class TwoFactorReusedError extends CredentialsSignin {
  code: string = TWO_FACTOR_ERROR_CODES.REUSED;
}

export class TwoFactorRateLimitedError extends CredentialsSignin {
  code: string = TWO_FACTOR_ERROR_CODES.RATE_LIMITED;
}

/** The 2FA code carried by a thrown sign-in error, or null for any other error. */
export function twoFactorErrorCode(error: unknown): TwoFactorErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== "string") return null;
  return (Object.values(TWO_FACTOR_ERROR_CODES) as string[]).includes(code)
    ? (code as TwoFactorErrorCode)
    : null;
}

/** Human copy for each code — shared by the sign-in form and challenge page. */
export function twoFactorErrorMessage(code: TwoFactorErrorCode): string {
  switch (code) {
    case TWO_FACTOR_ERROR_CODES.REQUIRED:
      return "Enter the 6-digit code from your authenticator app.";
    case TWO_FACTOR_ERROR_CODES.REUSED:
      return "That code was already used — wait for the next one.";
    case TWO_FACTOR_ERROR_CODES.RATE_LIMITED:
      return "Too many attempts. Wait a minute and try again.";
    case TWO_FACTOR_ERROR_CODES.INVALID:
    default:
      return "That code isn't valid. Try the current one, or use a recovery code.";
  }
}
