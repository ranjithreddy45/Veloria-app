"use server";

// ============================================================
// Two-factor authentication — self-service enrolment + challenge.
// ------------------------------------------------------------
// Every action gates on the signed-in user and only ever touches that user's
// own UserTwoFactor row. Enable / disable / recovery regeneration write an
// ActivityLog row. After any change to enrolment the session JWT is refreshed
// (unstable_update) so the banner and the challenge gate see it immediately.
// ============================================================

import { toDataURL as qrToDataURL } from "qrcode";
import { auth, unstable_update } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  TWO_FACTOR_ISSUER,
  buildOtpauthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  formatManualKey,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from "@/lib/security/two-factor";
import {
  readTwoFactorStatus,
  verifySecondFactor,
  type SecondFactorResult,
  type TwoFactorStatus,
} from "@/lib/security/two-factor-login";
import { isTwoFactorRequiredForRole } from "@/lib/security/two-factor-policy";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const SETUP_ATTEMPT_LIMIT = { maxRequests: 10, windowSeconds: 60 } as const;

function secondFactorFailureMessage(result: Extract<SecondFactorResult, { ok: false }>): string {
  switch (result.reason) {
    case "rate_limited":
      return "Too many attempts. Wait a minute and try again.";
    case "reused":
      return "That code was already used — wait for the next one.";
    case "not_enabled":
      return "Two-factor authentication is not enabled on this account.";
    default:
      return "That code isn't valid. Try the current one, or use a recovery code.";
  }
}

/** Refresh the JWT's 2FA flags; never let a refresh hiccup fail the action. */
async function refreshSessionToken() {
  try {
    await unstable_update({});
  } catch (error) {
    console.error("[2FA_SESSION_REFRESH_ERROR]", error);
  }
}

// ============================================================
// Status
// ============================================================

export async function getTwoFactorStatus(): Promise<
  ActionResult<TwoFactorStatus & { required: boolean }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const status = await readTwoFactorStatus(session.user.id);
    return {
      success: true,
      data: { ...status, required: isTwoFactorRequiredForRole(session.user.role) },
    };
  } catch (error) {
    console.error("[2FA_STATUS_ERROR]", error);
    return { success: false, error: "Couldn't load two-factor status." };
  }
}

// ============================================================
// Enrolment
// ============================================================

/**
 * Mint a fresh secret (replacing any unconfirmed one) and return what the
 * settings page needs to show: QR data-URL + manual key. Nothing is enabled
 * until confirmTwoFactorSetup verifies a code from the app.
 */
export async function startTwoFactorSetup(): Promise<
  ActionResult<{ qrDataUrl: string; manualKey: string; issuer: string; account: string }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const userId = session.user.id;

    const existing = await prisma.userTwoFactor.findUnique({
      where: { userId },
      select: { enabled: true },
    });
    if (existing?.enabled) {
      return {
        success: false,
        error: "Two-factor authentication is already enabled. Disable it first to re-enrol.",
      };
    }

    const secret = generateTotpSecret();
    const secretEnc = encryptTotpSecret(secret);
    await prisma.userTwoFactor.upsert({
      where: { userId },
      create: { userId, secretEnc, enabled: false, recoveryCodesHash: [] },
      update: { secretEnc, enabled: false, recoveryCodesHash: [], enabledAt: null, lastUsedAt: null },
    });

    const account = session.user.email ?? session.user.name ?? userId;
    const uri = buildOtpauthUri(account, secret);
    const qrDataUrl = await qrToDataURL(uri, { margin: 1, width: 224, errorCorrectionLevel: "M" });

    return {
      success: true,
      data: { qrDataUrl, manualKey: formatManualKey(secret), issuer: TWO_FACTOR_ISSUER, account },
    };
  } catch (error) {
    console.error("[2FA_START_SETUP_ERROR]", error);
    return { success: false, error: "Couldn't start two-factor setup. Please try again." };
  }
}

/**
 * Verify the first code from the app, switch 2FA on and hand back the 8
 * recovery codes — the only time they are ever shown in plain text.
 */
export async function confirmTwoFactorSetup(
  code: string
): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const userId = session.user.id;

    const limit = checkRateLimit(`2fa-setup:${userId}`, SETUP_ATTEMPT_LIMIT);
    if (!limit.success) {
      return { success: false, error: "Too many attempts. Wait a minute and try again." };
    }

    const row = await prisma.userTwoFactor.findUnique({ where: { userId } });
    if (!row) return { success: false, error: "Start the setup first." };
    if (row.enabled) {
      return { success: false, error: "Two-factor authentication is already enabled." };
    }

    const secret = decryptTotpSecret(row.secretEnc);
    const result = await verifyTotpCode(secret, String(code ?? ""));
    if (!result.valid) {
      return {
        success: false,
        error: "That code doesn't match. Check the time on your phone and try the next code.",
      };
    }

    const recoveryCodes = generateRecoveryCodes();
    const now = new Date();
    await prisma.userTwoFactor.update({
      where: { id: row.id },
      data: {
        enabled: true,
        enabledAt: now,
        // Period start of the confirmation code — that exact code can't be
        // replayed for the first sign-in.
        lastUsedAt: new Date(result.epoch * 1000),
        recoveryCodesHash: recoveryCodes.map((c) => hashRecoveryCode(c, userId)),
      },
    });

    await logActivity({
      userId,
      action: "two_factor_enabled",
      entityType: "User",
      entityId: userId,
      changes: { method: "totp", recoveryCodes: recoveryCodes.length },
    });
    await refreshSessionToken();

    return { success: true, data: { recoveryCodes } };
  } catch (error) {
    console.error("[2FA_CONFIRM_SETUP_ERROR]", error);
    return { success: false, error: "Couldn't confirm two-factor setup. Please try again." };
  }
}

/** Switch 2FA off. Requires a current authenticator or recovery code. */
export async function disableTwoFactor(code: string): Promise<ActionResult<{ disabled: true }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const userId = session.user.id;

    const result = await verifySecondFactor(userId, String(code ?? ""));
    if (!result.ok) return { success: false, error: secondFactorFailureMessage(result) };

    // Drop the row entirely: a re-enrolment always gets a brand-new secret.
    await prisma.userTwoFactor.deleteMany({ where: { userId } });

    await logActivity({
      userId,
      action: "two_factor_disabled",
      entityType: "User",
      entityId: userId,
      changes: { verifiedWith: result.method },
    });
    await refreshSessionToken();

    return { success: true, data: { disabled: true } };
  } catch (error) {
    console.error("[2FA_DISABLE_ERROR]", error);
    return { success: false, error: "Couldn't disable two-factor authentication. Please try again." };
  }
}

/** Replace every recovery code. Requires a current authenticator or recovery code. */
export async function regenerateRecoveryCodes(
  code: string
): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    const userId = session.user.id;

    const result = await verifySecondFactor(userId, String(code ?? ""));
    if (!result.ok) return { success: false, error: secondFactorFailureMessage(result) };

    const recoveryCodes = generateRecoveryCodes();
    const updated = await prisma.userTwoFactor.updateMany({
      where: { userId, enabled: true },
      data: { recoveryCodesHash: recoveryCodes.map((c) => hashRecoveryCode(c, userId)) },
    });
    if (updated.count === 0) {
      return { success: false, error: "Two-factor authentication is not enabled on this account." };
    }

    await logActivity({
      userId,
      action: "two_factor_recovery_regenerated",
      entityType: "User",
      entityId: userId,
      changes: { verifiedWith: result.method, recoveryCodes: recoveryCodes.length },
    });

    return { success: true, data: { recoveryCodes } };
  } catch (error) {
    console.error("[2FA_REGENERATE_ERROR]", error);
    return { success: false, error: "Couldn't regenerate recovery codes. Please try again." };
  }
}

// ============================================================
// Challenge — Google / WhatsApp sessions that still owe the second factor
// ============================================================

/**
 * Complete the second step for a session flagged `twoFactorPending`. On a
 * valid code the challenge row for THIS session's id is written, and the JWT
 * refreshed so the jwt callback clears the pending flag (auth.ts).
 */
export async function completeTwoFactorChallenge(
  code: string
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return { success: false, error: "Unauthorized" };
    if (!user.twoFactorPending || !user.twoFactorSid) {
      return { success: true, data: { redirectTo: homeForRole(user.role) } };
    }

    const result = await verifySecondFactor(user.id, String(code ?? ""));
    if (!result.ok) return { success: false, error: secondFactorFailureMessage(result) };

    const now = new Date();
    await prisma.userTwoFactorChallenge.upsert({
      where: { id: user.twoFactorSid },
      create: { id: user.twoFactorSid, userId: user.id, verifiedAt: now },
      update: { verifiedAt: now },
    });
    // Opportunistic sweep of challenges nobody ever completed.
    await prisma.userTwoFactorChallenge
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);

    await refreshSessionToken();

    return { success: true, data: { redirectTo: homeForRole(user.role) } };
  } catch (error) {
    console.error("[2FA_CHALLENGE_ERROR]", error);
    return { success: false, error: "Couldn't verify the code. Please try again." };
  }
}

function homeForRole(role: string | undefined): string {
  if (role === "CLIENT") return "/portal";
  if (role === "VENDOR") return "/vendor-portal";
  return "/dashboard";
}
