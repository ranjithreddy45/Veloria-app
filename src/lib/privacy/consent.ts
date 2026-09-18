// ============================================================
// Consent ledger — server-side helper shared by every public form.
// ------------------------------------------------------------
// recordConsent() writes ONE ConsentRecord row and never throws: consent
// evidence must never be the reason a lead, RSVP or application is lost.
// Raw IPs are never stored — only a salted SHA-256 (PRIVACY_IP_SALT, falling
// back to AUTH_SECRET). Works inside route handlers and server actions; when
// called outside a request scope (cron, script) it simply records no ip/UA.
// ============================================================

import { createHash } from "crypto";
import { headers } from "next/headers";
import { clientIpOfHeaders } from "@/lib/hr/geo";
import { prisma } from "@/lib/prisma";
import {
  CONSENT_TEXT_ENQUIRY,
  type ConsentPurpose,
  type ConsentSubjectType,
} from "@/lib/privacy/consent-text";

export type { ConsentPurpose, ConsentSubjectType } from "@/lib/privacy/consent-text";

export interface RecordConsentInput {
  subjectType: ConsentSubjectType;
  /** Contact / Guest / RecCandidate / User id when known. */
  subjectId?: string | null;
  email?: string | null;
  phone?: string | null;
  purpose: ConsentPurpose;
  /** Form slug or route that captured the consent, e.g. "/visit". */
  source: string;
  /** The sentence shown to the person. Defaults to the enquiry wording. */
  consentText?: string | null;
  /** Raw client IP — hashed here, never stored. Read from headers() when omitted. */
  ip?: string | null;
  /** Read from headers() when omitted. */
  userAgent?: string | null;
}

/**
 * Salted, one-way hash of a client IP for abuse analysis and request
 * correlation. Returns null (drops the signal) rather than storing a
 * guessable value when no salt is configured. Never throws.
 */
export function hashPrivacyIp(ip?: string | null): string | null {
  const cleanIp = (ip ?? "").trim();
  if (!cleanIp || cleanIp === "unknown") return null;
  const salt = (process.env.PRIVACY_IP_SALT || process.env.AUTH_SECRET || "").trim();
  if (!salt) return null;
  try {
    return createHash("sha256").update(`${salt}:${cleanIp}`).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Best-effort client metadata from the current request. Returns nulls
 * outside a request scope instead of throwing.
 */
export async function requestClientMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const ip = clientIpOfHeaders(h);
    const userAgent = h.get("user-agent")?.slice(0, 512) || null;
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Record that a person gave consent. Resolves to the new row id, or null if
 * the write failed (logged, never thrown).
 */
export async function recordConsent(input: RecordConsentInput): Promise<string | null> {
  try {
    const meta =
      input.ip === undefined || input.userAgent === undefined
        ? await requestClientMeta()
        : { ip: null, userAgent: null };
    const ip = input.ip === undefined ? meta.ip : input.ip;
    const userAgent = input.userAgent === undefined ? meta.userAgent : input.userAgent;

    const row = await prisma.consentRecord.create({
      data: {
        subjectType: input.subjectType,
        subjectId: input.subjectId || null,
        email: input.email?.trim().toLowerCase() || null,
        phone: input.phone?.trim() || null,
        purpose: input.purpose,
        source: input.source.slice(0, 200),
        consentText: (input.consentText || CONSENT_TEXT_ENQUIRY).slice(0, 2000),
        ipHash: hashPrivacyIp(ip),
        userAgent: userAgent ? userAgent.slice(0, 512) : null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    console.error("[CONSENT_RECORD_ERROR]", error);
    return null;
  }
}
