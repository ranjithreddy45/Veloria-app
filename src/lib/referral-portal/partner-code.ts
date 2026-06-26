import { prisma } from "@/lib/prisma";

// ============================================================
// Referral Partner Code Utilities (NOT "use server")
// ------------------------------------------------------------
// Mirrors src/lib/referral-code.ts generateUniqueCode, but collision-checks
// against ReferralPartner.code (which is @unique) rather than
// Referral.referralCode. Kept as a SEPARATE lib so referral-code.ts stays
// untouched and each generator guards the correct table.
//
// Codes are 8 chars from an unambiguous alphabet (excludes I, O, 0, 1) so they
// are safe to read aloud / print on a QR card. The code is the ONLY access
// control for the public /refer/<code> page, so it must be unguessable.
// ============================================================

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generatePartnerCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  }
  return code;
}

/**
 * Generate a partner code unique against ReferralPartner.code.
 * Retries up to 6 times; falls back to a timestamp-suffixed code that is
 * still validated for collision before returning.
 */
export async function generateUniquePartnerCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = generatePartnerCode();
    const existing = await prisma.referralPartner.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Fallback: timestamp-based, then verify once more.
  const fallback = `VP${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const clash = await prisma.referralPartner.findUnique({
    where: { code: fallback },
    select: { id: true },
  });
  return clash ? `${fallback}${Math.floor(Math.random() * 90 + 10)}` : fallback;
}

/**
 * The canonical public referral landing URL for a partner code.
 * Mounted at /refer/<code> under the (public) route group.
 */
export function buildPartnerLink(code: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL || "https://veloriagrand.com"
  ).replace(/\/+$/, "");
  return `${base}/refer/${code}`;
}

/**
 * Payload encoded into the partner's QR image — the full shareable link.
 * Centralised so the QR and the copy-link button always agree.
 */
export function buildPartnerQrPayload(code: string): string {
  return buildPartnerLink(code);
}
