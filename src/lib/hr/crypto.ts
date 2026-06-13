// ============================================================
// hr-crypto — encryption at rest for statutory PII (PAN, Aadhaar,
// bank account). AES-256-GCM (authenticated). Server-only.
//
// Key source, in order of preference:
//   1. HR_ENCRYPTION_KEY  — 32-byte key as base64 or 64-char hex (recommended)
//   2. derived from AUTH_SECRET / NEXTAUTH_SECRET via scrypt (works out of the
//      box without provisioning a new secret; rotate to a dedicated key later)
//
// Stored format:  v1:<ivB64>:<tagB64>:<cipherB64>
// The version prefix lets us rotate keys/algorithms later without ambiguity.
// ============================================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";

let cachedKey: Buffer | null = null;

function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const explicit = process.env.HR_ENCRYPTION_KEY;
  if (explicit && explicit.trim()) {
    const raw = explicit.trim();
    // hex (64 chars) or base64
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      cachedKey = Buffer.from(raw, "hex");
      return cachedKey;
    }
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) {
      cachedKey = b;
      return cachedKey;
    }
    // fall through to derive from whatever string was given
    cachedKey = scryptSync(raw, "ppg-hr-statutory", 32);
    return cachedKey;
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "hr-crypto: no encryption key. Set HR_ENCRYPTION_KEY (32-byte base64/hex) or AUTH_SECRET."
    );
  }
  cachedKey = scryptSync(secret, "ppg-hr-statutory", 32);
  return cachedKey;
}

/** Encrypt a plaintext string. Returns the versioned, self-describing token. */
export function encryptField(plain: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/** Decrypt a token produced by encryptField. Returns null on any failure. */
export function decryptField(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const key = resolveKey();
    const iv = Buffer.from(parts[1], "base64");
    const tag = Buffer.from(parts[2], "base64");
    const data = Buffer.from(parts[3], "base64");
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    return null;
  }
}

/** True if a value looks like one of our encrypted tokens. */
export function isEncrypted(token: string | null | undefined): boolean {
  return !!token && token.startsWith(`${VERSION}:`) && token.split(":").length === 4;
}

// --- masking helpers (UI display) -------------------------------------------

/** Generic: keep the last `visible` chars, mask the rest. */
export function maskTail(value: string | null | undefined, visible = 4): string | null {
  if (!value) return null;
  const v = value.replace(/\s+/g, "");
  if (v.length <= visible) return "•".repeat(v.length);
  return "•".repeat(Math.max(4, v.length - visible)) + v.slice(-visible);
}

/** PAN: ABCDE1234F → •••••••234F (last 4). */
export function maskPan(value: string | null | undefined): string | null {
  return maskTail(value, 4);
}

/** Aadhaar: 12 digits → XXXX XXXX 1234. */
export function maskAadhaar(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.replace(/\D/g, "");
  if (v.length < 4) return "••••";
  return `XXXX XXXX ${v.slice(-4)}`;
}

/** Bank account → mask all but last 4. */
export function maskAccount(value: string | null | undefined): string | null {
  return maskTail(value, 4);
}
