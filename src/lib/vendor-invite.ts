// ============================================================
// Vendor portal invite tokens — staff-driven vendor onboarding.
// ============================================================
// The vendor portal is gated on the VENDOR role, but there was no supported way
// to provision a VENDOR-role login (admin user-create excludes VENDOR; signup
// defaults to CLIENT). This closes that gap: staff generate a single-use invite
// link for a Vendor; the vendor opens it (logged OUT) and sets their own password,
// which creates a VENDOR account bound to the vendor's email (getCurrentVendor
// binds the portal by email).
//
// Reuses the NextAuth `VerificationToken` model (identifier/token/expires) — no
// migration. The identifier namespaces the token to a specific vendor, so a token
// issued for vendor A can never activate vendor B.

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const IDENTIFIER_PREFIX = "vendor-invite:";

function hashToken(token: string): string {
  const pepper = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${token}:${pepper}`).digest("hex");
}

/** Create a single-use invite for a vendor. Returns the RAW token (only the hash
 * is stored). Any prior unused invite for the same vendor is dropped. */
export async function createVendorInvite(vendorId: string): Promise<string> {
  const identifier = `${IDENTIFIER_PREFIX}${vendorId}`;
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: tokenHash, expires: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return rawToken;
}

/** Validate a token against the vendor it was issued for (does NOT consume it).
 * Expired tokens are cleaned up as a side effect. */
export async function checkVendorInvite(vendorId: string, token: string): Promise<"valid" | "invalid" | "expired"> {
  if (!vendorId || !token) return "invalid";
  const identifier = `${IDENTIFIER_PREFIX}${vendorId}`;
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findFirst({ where: { identifier, token: tokenHash } });
  if (!record) return "invalid";
  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { identifier, token: tokenHash } });
    return "expired";
  }
  return "valid";
}

/** Single-use: delete the token once the account is provisioned. */
export async function consumeVendorInvite(vendorId: string, token: string): Promise<void> {
  const identifier = `${IDENTIFIER_PREFIX}${vendorId}`;
  await prisma.verificationToken.deleteMany({ where: { identifier, token: hashToken(token) } });
}
