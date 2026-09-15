// ============================================================
// VAPID configuration — the ONLY place the push env vars are read.
//
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  handed to the browser (pushManager.subscribe)
//   VAPID_PRIVATE_KEY             server-only, signs every push request
//   VAPID_SUBJECT                 "mailto:" or "https://" contact for push services
//
// Generate a pair with `npx tsx scripts/generate-vapid-keys.ts`. Never log the
// private key. Everything here is sync and side-effect free so it can be
// called from both server actions and the sender.
// ============================================================

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const ENV_PUBLIC = "NEXT_PUBLIC_VAPID_PUBLIC_KEY";
const ENV_PRIVATE = "VAPID_PRIVATE_KEY";
const ENV_SUBJECT = "VAPID_SUBJECT";

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Public key only — safe to hand to the browser. Null when unset. */
export function getVapidPublicKey(): string | null {
  const key = clean(process.env[ENV_PUBLIC]);
  return key.length > 0 ? key : null;
}

/**
 * Subject must be a `mailto:` or `https://` URL — push services use it to
 * contact the sender about abuse. Falls back to the company email when the
 * explicit var is unset so a half-configured env still works; an explicit but
 * malformed value returns null (surfaced by `describeMissingVapid`).
 */
export function getVapidSubject(): string | null {
  const explicit = clean(process.env[ENV_SUBJECT]);
  if (explicit) {
    return /^(mailto:|https:\/\/)/i.test(explicit) ? explicit : null;
  }
  const email = clean(process.env.NEXT_PUBLIC_COMPANY_EMAIL);
  return email.includes("@") ? `mailto:${email}` : null;
}

/** Full signing config, or null when push is not (fully) configured. */
export function getVapidConfig(): VapidConfig | null {
  const publicKey = getVapidPublicKey();
  const privateKey = clean(process.env[ENV_PRIVATE]);
  const subject = getVapidSubject();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return getVapidConfig() !== null;
}

/** Human-readable list of what is missing/invalid, for the one-time warn. */
export function describeMissingVapid(): string[] {
  const missing: string[] = [];
  if (!getVapidPublicKey()) missing.push(ENV_PUBLIC);
  if (!clean(process.env[ENV_PRIVATE])) missing.push(ENV_PRIVATE);
  if (!getVapidSubject()) {
    missing.push(
      clean(process.env[ENV_SUBJECT])
        ? `${ENV_SUBJECT} (must start with mailto: or https://)`
        : ENV_SUBJECT
    );
  }
  return missing;
}
