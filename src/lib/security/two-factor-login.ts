// ============================================================
// Second-factor verification shared by every sign-in path.
// ------------------------------------------------------------
// Used by the credentials `authorize` (auth.ts), the /two-factor challenge for
// Google / WhatsApp sessions, and the disable / regenerate settings actions.
// Node-only (Prisma).
// ============================================================

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  TOTP_CODE_RE,
  decryptTotpSecret,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  safeEqualHex,
  totpStepFromDate,
  verifyTotpCode,
} from "@/lib/security/two-factor";

/** 5 code attempts per user per minute, across every sign-in path. */
export const TWO_FACTOR_ATTEMPT_LIMIT = { maxRequests: 5, windowSeconds: 60 } as const;

export type SecondFactorResult =
  | { ok: true; method: "totp" | "recovery"; recoveryCodesLeft: number }
  | { ok: false; reason: "not_enabled" | "rate_limited" | "invalid" | "reused" };

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt: Date | null;
  lastUsedAt: Date | null;
  recoveryCodesLeft: number;
  /** A secret exists but was never confirmed with a code (setup abandoned). */
  setupPending: boolean;
}

export async function isTwoFactorEnabled(userId: string): Promise<boolean> {
  const row = await prisma.userTwoFactor.findUnique({
    where: { userId },
    select: { enabled: true },
  });
  return !!row?.enabled;
}

export async function readTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const row = await prisma.userTwoFactor.findUnique({
    where: { userId },
    select: { enabled: true, enabledAt: true, lastUsedAt: true, recoveryCodesHash: true },
  });
  return {
    enabled: !!row?.enabled,
    enabledAt: row?.enabledAt ?? null,
    lastUsedAt: row?.lastUsedAt ?? null,
    recoveryCodesLeft: row?.enabled ? row.recoveryCodesHash.length : 0,
    setupPending: !!row && !row.enabled,
  };
}

/**
 * Verify a 6-digit TOTP or a recovery code for a user whose 2FA is enabled.
 * - Rate-limited per userId (in-memory, 5/min).
 * - A TOTP from a period at or before the last accepted one is rejected
 *   ("reused"), so a captured code cannot be replayed inside its window.
 * - A recovery code is consumed atomically (compare-and-set on the hash list).
 */
export async function verifySecondFactor(
  userId: string,
  rawCode: string
): Promise<SecondFactorResult> {
  const row = await prisma.userTwoFactor.findUnique({ where: { userId } });
  if (!row?.enabled) return { ok: false, reason: "not_enabled" };

  const limit = checkRateLimit(`2fa:${userId}`, TWO_FACTOR_ATTEMPT_LIMIT);
  if (!limit.success) return { ok: false, reason: "rate_limited" };

  const code = rawCode.trim();

  // --- Authenticator code ------------------------------------------------
  if (TOTP_CODE_RE.test(code.replace(/\s+/g, ""))) {
    let secret: string;
    try {
      secret = decryptTotpSecret(row.secretEnc);
    } catch (error) {
      console.error("[2FA_SECRET_DECRYPT_ERROR]", error);
      return { ok: false, reason: "invalid" };
    }
    const afterTimeStep = row.lastUsedAt ? totpStepFromDate(row.lastUsedAt) : undefined;
    const result = await verifyTotpCode(secret, code, afterTimeStep);
    if (!result.valid) return { ok: false, reason: result.reason };

    await prisma.userTwoFactor.update({
      where: { id: row.id },
      // Period start of the matched code — the replay guard derives the
      // time-step from it on the next attempt.
      data: { lastUsedAt: new Date(result.epoch * 1000) },
    });
    return { ok: true, method: "totp", recoveryCodesLeft: row.recoveryCodesHash.length };
  }

  // --- Recovery code -------------------------------------------------------
  if (looksLikeRecoveryCode(code)) {
    const digest = hashRecoveryCode(code, userId);
    const match = row.recoveryCodesHash.find((stored) => safeEqualHex(stored, digest));
    if (!match) return { ok: false, reason: "invalid" };

    const remaining = row.recoveryCodesHash.filter((stored) => stored !== match);
    // Compare-and-set: a concurrent use of the same code loses the race.
    const consumed = await prisma.userTwoFactor.updateMany({
      where: { id: row.id, recoveryCodesHash: { has: match } },
      data: { recoveryCodesHash: remaining, lastUsedAt: new Date() },
    });
    if (consumed.count === 0) return { ok: false, reason: "invalid" };
    return { ok: true, method: "recovery", recoveryCodesLeft: remaining.length };
  }

  return { ok: false, reason: "invalid" };
}

/**
 * Flags baked into the session JWT (auth.ts). Fail-open on a DB hiccup so a
 * transient outage never blocks sign-in — the periodic re-check catches up.
 */
export async function loadTwoFactorTokenFlags(
  userId: string
): Promise<{ enabled: boolean }> {
  try {
    return { enabled: await isTwoFactorEnabled(userId) };
  } catch (error) {
    console.error("[2FA_TOKEN_FLAGS_ERROR]", error);
    return { enabled: false };
  }
}

/**
 * Has the challenge identified by `challengeId` been passed by this user?
 * Consumes (deletes) the row when it has, so a challenge id is single-use.
 */
export async function consumeVerifiedChallenge(
  challengeId: string,
  userId: string
): Promise<boolean> {
  const row = await prisma.userTwoFactorChallenge.findUnique({ where: { id: challengeId } });
  if (!row || row.userId !== userId || !row.verifiedAt) return false;
  await prisma.userTwoFactorChallenge
    .delete({ where: { id: challengeId } })
    .catch(() => undefined);
  return true;
}
