// ============================================================
// One-time passcode (OTP) core — passwordless WhatsApp login.
// Plain library (no "use server"): used by the request action AND
// the NextAuth credentials provider. Never returns plaintext to a client.
// ============================================================

import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

/** Normalize any Indian/international input to digits incl. country code. */
export function normalizeOtpPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d; // bare 10-digit Indian mobile
  else if (d.length === 11 && d.startsWith("0")) d = "91" + d.slice(1);
  return d;
}

/** Common stored formats for the same number, so we can match User.phone. */
export function phoneVariants(normalized: string): string[] {
  const last10 = normalized.slice(-10);
  return Array.from(
    new Set([
      normalized,
      `+${normalized}`,
      last10,
      `+91${last10}`,
      `91${last10}`,
      `0${last10}`,
    ])
  );
}

function hashCode(code: string): string {
  const pepper = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}

/** Cryptographically-uniform 6-digit code (000000–999999). */
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Find THE active user whose stored phone matches this number. If more than one
 * active account shares the phone, the match is ambiguous — refuse rather than
 * non-deterministically log the requester into someone else's account.
 */
export async function findActiveUserByPhone(normalized: string) {
  if (!normalized) return null;
  const matches = await prisma.user.findMany({
    where: { phone: { in: phoneVariants(normalized) }, isActive: true },
    select: { id: true, name: true, email: true, image: true, role: true },
    take: 2,
  });
  if (matches.length !== 1) return null; // none, or ambiguous
  return matches[0];
}

/**
 * Create a fresh login code for a phone. Invalidates prior unconsumed codes.
 * Returns the PLAINTEXT code so the caller can send it over WhatsApp.
 * (The caller must never return this to the browser.)
 */
export async function createLoginOtp(normalized: string): Promise<string> {
  // Burn any outstanding codes for this number.
  await prisma.otpCode.updateMany({
    where: { phone: normalized, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  await prisma.otpCode.create({
    data: {
      phone: normalized,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * Verify a submitted code for a phone. Single-use, time-boxed, attempt-capped.
 * Returns true only on an exact, unexpired, unconsumed match.
 */
export async function verifyLoginOtp(
  normalized: string,
  code: string
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  const row = await prisma.otpCode.findFirst({
    where: {
      phone: normalized,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return false;

  if (row.attempts >= MAX_ATTEMPTS) {
    await prisma.otpCode.update({
      where: { id: row.id },
      data: { consumedAt: new Date() }, // lock it out
    });
    return false;
  }

  const ok = row.codeHash === hashCode(code);
  if (!ok) {
    await prisma.otpCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  // Success — consume so the code can't be reused.
  await prisma.otpCode.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return true;
}
