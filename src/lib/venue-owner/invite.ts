// ============================================================
// Venue-owner invite tokens — staff-driven owner onboarding.
// ============================================================
// Mirrors src/lib/vendor-invite.ts. An admin creates the owner's login
// (VENUE_OWNER, inactive, no password) at Settings → Venue owners and shares a
// single-use link; the owner opens it (logged OUT) and sets their own password,
// which activates the login.
//
// Reuses the NextAuth `VerificationToken` model (identifier/token/expires) — no
// migration. The identifier namespaces the token to one owner login, so a token
// issued for owner A can never activate owner B. Only the hash is stored.

import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { OWNER_INVITE_DAYS } from "./admin-rules";

const INVITE_TTL_MS = OWNER_INVITE_DAYS * 24 * 60 * 60 * 1000; // 14 days
const IDENTIFIER_PREFIX = "venue-owner-invite:";

type Db = Prisma.TransactionClient | typeof prisma;

function hashToken(token: string): string {
  const pepper = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${token}:${pepper}`).digest("hex");
}

/** The VerificationToken identifier for one owner login. */
export function venueOwnerInviteIdentifier(userId: string): string {
  return `${IDENTIFIER_PREFIX}${userId}`;
}

/** Create a single-use invite for an owner login. Returns the RAW token (only
 * the hash is stored). Any prior unused invite for the same owner is dropped,
 * so regenerating a link kills the old one. */
export async function createVenueOwnerInvite(userId: string): Promise<string> {
  const identifier = venueOwnerInviteIdentifier(userId);
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token: tokenHash, expires: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return rawToken;
}

/** Validate a token against the owner it was issued for (does NOT consume it).
 * Expired tokens are cleaned up as a side effect. */
export async function checkVenueOwnerInvite(userId: string, token: string): Promise<"valid" | "invalid" | "expired"> {
  if (!userId || !token) return "invalid";
  const identifier = venueOwnerInviteIdentifier(userId);
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findFirst({ where: { identifier, token: tokenHash } });
  if (!record) return "invalid";
  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { identifier, token: tokenHash } });
    return "expired";
  }
  return "valid";
}

/** Single-use: delete the token once the login is activated. Returns whether
 * this call removed it — inside a transaction, two racing activations cannot
 * both see true (the second DELETE waits on the first's row lock, then finds
 * nothing). */
export async function consumeVenueOwnerInvite(userId: string, token: string, db: Db = prisma): Promise<boolean> {
  const identifier = venueOwnerInviteIdentifier(userId);
  const { count } = await db.verificationToken.deleteMany({ where: { identifier, token: hashToken(token) } });
  return count > 0;
}

/** Drop every outstanding invite for an owner (the link stops working). */
export async function revokeVenueOwnerInvites(userId: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier: venueOwnerInviteIdentifier(userId) } });
}

/** When each owner's outstanding invite expires (absent = no invite on file).
 * For the admin list only; never exposes the token. */
export async function getVenueOwnerInviteExpiries(userIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (userIds.length === 0) return out;
  const rows = await prisma.verificationToken.findMany({
    where: { identifier: { in: userIds.map(venueOwnerInviteIdentifier) } },
    select: { identifier: true, expires: true },
  });
  for (const row of rows) {
    const userId = row.identifier.slice(IDENTIFIER_PREFIX.length);
    const prev = out.get(userId);
    if (!prev || row.expires > prev) out.set(userId, row.expires);
  }
  return out;
}
