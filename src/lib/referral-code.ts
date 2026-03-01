import { prisma } from "@/lib/prisma";

// ============================================================
// Referral Code Utilities
// ============================================================

/**
 * Generate an 8-character alphanumeric code.
 * Excludes confusing characters: I, O, 0, 1
 */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a unique referral code, checking for collisions in the database.
 * Retries up to 5 times; falls back to a timestamp-based code.
 */
export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const existing = await prisma.referral.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  // Fallback: timestamp-based
  return `VG${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Build a full referral link from a referral code.
 */
export function buildReferralLink(code: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://veloriagrand.com";
  return `${baseUrl}/refer/${code}`;
}
