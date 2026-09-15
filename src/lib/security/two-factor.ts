// ============================================================
// Two-factor authentication primitives (Node-only: uses node:crypto).
// ------------------------------------------------------------
// - TOTP secret generation / otpauth URI / code verification (otplib v13)
// - AES-256-GCM encryption of the secret at rest
// - Recovery codes: generation, normalisation, salted SHA-256 hashing
//
// Never import this from auth.config.ts or anything that runs on the edge.
// ============================================================

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";
import { generateSecret, generateURI, verify } from "otplib";

export const TWO_FACTOR_ISSUER = "Veloria Grand";
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_CODE_RE = /^\d{6}$/;
export const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_LENGTH = 10;
// No 0/O/1/I — the codes are read off a printout and typed by hand.
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ------------------------------------------------------------
// Encryption key
// ------------------------------------------------------------

const CIPHER = "aes-256-gcm";
let warnedDerivedKey = false;

/**
 * 32-byte AES key. Prefers TOTP_ENCRYPTION_KEY (base64, 32 bytes); otherwise a
 * SHA-256 derivation of AUTH_SECRET with a one-time console warning — rotating
 * AUTH_SECRET would then invalidate every enrolled authenticator.
 */
function getEncryptionKey(): Buffer {
  const configured = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) {
      throw new Error(
        "TOTP_ENCRYPTION_KEY must decode to exactly 32 bytes (generate with: openssl rand -base64 32)"
      );
    }
    return key;
  }

  const seed = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!seed) {
    throw new Error(
      "Two-factor authentication needs TOTP_ENCRYPTION_KEY (or AUTH_SECRET) to be set"
    );
  }
  if (!warnedDerivedKey) {
    warnedDerivedKey = true;
    console.warn(
      "[2FA] TOTP_ENCRYPTION_KEY is not set — deriving the authenticator-secret encryption key from AUTH_SECRET. Set a dedicated TOTP_ENCRYPTION_KEY before relying on this in production."
    );
  }
  return createHash("sha256").update(`veloria:totp-secret-key:${seed}`).digest();
}

/** Encrypt a base32 TOTP secret → "v1.<iv>.<ciphertext>.<authTag>" (all base64). */
export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), ciphertext.toString("base64"), tag.toString("base64")].join(".");
}

/** Inverse of encryptTotpSecret. Throws on tampering or a changed key. */
export function decryptTotpSecret(payload: string): string {
  const [version, ivB64, ctB64, tagB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !ctB64 || !tagB64) {
    throw new Error("Malformed encrypted TOTP secret");
  }
  const decipher = createDecipheriv(CIPHER, getEncryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// ------------------------------------------------------------
// TOTP
// ------------------------------------------------------------

/** Fresh base32 secret (20 random bytes — Google Authenticator compatible). */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI for the QR code, labelled "Veloria Grand:<email>". */
export function buildOtpauthUri(accountLabel: string, secret: string): string {
  return generateURI({ issuer: TWO_FACTOR_ISSUER, label: accountLabel, secret });
}

/** "JBSW Y3DP EHPK 3PXP" — easier to type into an app by hand. */
export function formatManualKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** RFC 6238 time-step number for a moment in time. */
export function totpStepFromDate(date: Date): number {
  return Math.floor(date.getTime() / 1000 / TOTP_PERIOD_SECONDS);
}

export type TotpVerification =
  | { valid: true; epoch: number; timeStep: number }
  | { valid: false; reason: "invalid" | "reused" };

/**
 * Verify a 6-digit code against a base32 secret, accepting one period of
 * clock drift either side. `afterTimeStep` rejects any code from a period at
 * or before it (replay protection) and is reported as `reused`.
 */
export async function verifyTotpCode(
  secret: string,
  code: string,
  afterTimeStep?: number
): Promise<TotpVerification> {
  const token = code.replace(/\s+/g, "");
  if (!TOTP_CODE_RE.test(token)) return { valid: false, reason: "invalid" };

  const result = await verify({
    secret,
    token,
    epochTolerance: TOTP_PERIOD_SECONDS,
    ...(afterTimeStep !== undefined ? { afterTimeStep } : {}),
  });

  if (result.valid) {
    const now = Math.floor(Date.now() / 1000);
    const timeStep =
      "timeStep" in result && typeof result.timeStep === "number"
        ? result.timeStep
        : Math.floor(now / TOTP_PERIOD_SECONDS);
    const epoch =
      "epoch" in result && typeof result.epoch === "number"
        ? result.epoch
        : timeStep * TOTP_PERIOD_SECONDS;
    return { valid: true, epoch, timeStep };
  }

  // Distinguish "already used this period" from "wrong code" for the message.
  if (afterTimeStep !== undefined) {
    const replay = await verify({ secret, token, epochTolerance: TOTP_PERIOD_SECONDS });
    if (replay.valid) return { valid: false, reason: "reused" };
  }
  return { valid: false, reason: "invalid" };
}

// ------------------------------------------------------------
// Recovery codes
// ------------------------------------------------------------

/** 8 codes like "K7MP3-Q9XZ2" (10 chars, ~50 bits each), CSPRNG. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let raw = "";
    for (let j = 0; j < RECOVERY_CODE_LENGTH; j++) {
      raw += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    }
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

/** Upper-case, strip separators/whitespace. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function looksLikeRecoveryCode(input: string): boolean {
  return normalizeRecoveryCode(input).length === RECOVERY_CODE_LENGTH;
}

/** Salted with the userId so identical codes across users hash differently. */
export function hashRecoveryCode(code: string, userId: string): string {
  return createHash("sha256")
    .update(`veloria:recovery:${userId}:${normalizeRecoveryCode(code)}`)
    .digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
