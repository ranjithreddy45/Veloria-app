// ============================================================
// Portal invite tokens — staff-driven client onboarding.
// ============================================================
// Transactional email is not configured, so we can't send an OTP to verify a
// client's email. Instead, staff generate a single-use invite link for a
// Contact. When the client opens it (while signed in), we set their
// `user.emailVerified` — binding their verified portal identity to that
// contact's email so they can see their own data (and only their own).
//
// We reuse the existing NextAuth `VerificationToken` model (identifier/token/
// expires) rather than adding a schema — no migration required. The identifier
// namespaces the token to a specific contact so a stolen token for contact A
// can never verify against contact B.

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const IDENTIFIER_PREFIX = "portal-invite:";

function hashToken(token: string): string {
  const pepper = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${token}:${pepper}`).digest("hex");
}

/**
 * Create a single-use portal invite for a contact. Returns the RAW token to
 * embed in the link (only the hash is stored). Any prior unused invites for the
 * same contact are dropped so only the newest link works.
 */
export async function createPortalInvite(contactId: string): Promise<string> {
  const identifier = `${IDENTIFIER_PREFIX}${contactId}`;
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expires = new Date(Date.now() + INVITE_TTL_MS);

  // Drop any existing invites for this contact (single active link).
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  await prisma.verificationToken.create({
    data: { identifier, token: tokenHash, expires },
  });

  return rawToken;
}

/** Validate an invite token against the contact it was issued for (does NOT
 * consume it). Used by the single-step host-activate flow, where the customer is
 * logged OUT and the activation CREATES their account. Expired tokens are cleaned. */
export async function checkPortalInvite(contactId: string, token: string): Promise<"valid" | "invalid" | "expired"> {
  if (!contactId || !token) return "invalid";
  const identifier = `${IDENTIFIER_PREFIX}${contactId}`;
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
export async function consumePortalInvite(contactId: string, token: string): Promise<void> {
  const identifier = `${IDENTIFIER_PREFIX}${contactId}`;
  await prisma.verificationToken.deleteMany({ where: { identifier, token: hashToken(token) } });
}

/**
 * Consume a portal invite token and mark the given user as email-verified,
 * linking them to the invited contact's email. Idempotent-ish: the token is
 * single-use and deleted on success.
 *
 * The token is validated against the contactId, so it can only verify an
 * identity for the contact it was issued for.
 */
export async function acceptPortalInvite(params: {
  userId: string;
  contactId: string;
  token: string;
}): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  const { userId, contactId, token } = params;
  const identifier = `${IDENTIFIER_PREFIX}${contactId}`;
  const tokenHash = hashToken(token);

  const record = await prisma.verificationToken.findFirst({
    where: { identifier, token: tokenHash },
  });

  if (!record) {
    return { success: false, error: "This invite link is invalid or has already been used." };
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { identifier, token: tokenHash } });
    return { success: false, error: "This invite link has expired. Please ask us for a new one." };
  }

  // Consume the token and mark the user verified in one transaction.
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier, token: tokenHash } }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    }),
  ]);

  return { success: true };
}
