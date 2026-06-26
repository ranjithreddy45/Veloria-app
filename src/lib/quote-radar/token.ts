// ============================================================
// Quote Radar — pure token / device / ip-hash helpers.
// ------------------------------------------------------------
// No "use server", no IO. Used by the share-link minting actions and the
// public view-recording action. Mirrors the unguessable-token convention of
// PublicHold / ReviewRequest, but uses crypto.randomBytes(24).base64url so the
// token is the SOLE access control for the public /q/<token> page (no auth) —
// same threat model as /pay/[invoiceId].
// ============================================================

import { createHash, randomBytes } from "crypto";
import type { QuoteViewDevice } from "@prisma/client";

/**
 * Mint an unguessable, URL-safe share token. 24 random bytes → 32 base64url
 * chars (~192 bits of entropy), so the link cannot be enumerated or guessed.
 */
export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * Cheap, defensive validity check for an inbound token before a DB lookup —
 * rejects obviously-malformed/short values so a bad token 404s without a query.
 */
export function looksLikeShareToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(token);
}

const BOT_UA_RE =
  /(bot|crawler|spider|crawling|facebookexternalhit|whatsapp|slackbot|telegrambot|discordbot|preview|linkpreview|embedly|quora link preview|pinterest|vkshare|twitterbot|google-?(?:bot|other)|bingbot|yandex|baiduspider|duckduckbot|applebot|ia_archiver|skypeuripreview)/i;

/**
 * Best-effort: is this user-agent a link-unfurl crawler (WhatsApp/Slack/etc.)?
 * Used so a preview crawler open doesn't falsely trip the "opened" radar / the
 * 24h recovery trigger. Never throws.
 */
export function isLikelyBot(ua?: string | null): boolean {
  if (!ua) return false;
  try {
    return BOT_UA_RE.test(ua);
  } catch {
    return false;
  }
}

/**
 * Parse a coarse device class from the user-agent. Order matters: tablets must
 * be checked before the generic mobile match. Falls back to UNKNOWN.
 */
export function parseDeviceFromUA(ua?: string | null): QuoteViewDevice {
  if (!ua) return "UNKNOWN";
  const s = ua.toLowerCase();
  // Tablet first (iPads and Android tablets often also match "mobile" tokens).
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return "TABLET";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini|windows phone/.test(s)) return "MOBILE";
  if (/windows|macintosh|mac os x|linux|cros|x11/.test(s)) return "DESKTOP";
  return "UNKNOWN";
}

/**
 * Hash an IP for unique-visitor dedupe WITHOUT storing raw PII. Salt comes from
 * env; if no stable salt is configured we degrade to null (drop dedupe) rather
 * than store a guessable/raw value. Never throws.
 */
export function hashIp(ip?: string | null, salt?: string | null): string | null {
  const cleanIp = (ip ?? "").trim();
  if (!cleanIp || cleanIp === "unknown") return null;
  const useSalt = (salt ?? process.env.QUOTE_VIEW_IP_SALT ?? "").trim();
  if (!useSalt) return null; // no stable salt → skip dedupe rather than leak PII
  try {
    return createHash("sha256").update(`${useSalt}:${cleanIp}`).digest("hex");
  } catch {
    return null;
  }
}
