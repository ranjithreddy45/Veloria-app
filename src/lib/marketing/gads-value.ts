// ============================================================
// Google Ads — qualified-lead value mapping + offline-conversion helpers
// ------------------------------------------------------------
// Tells Google a wedding lead is worth ~6× a birthday lead. Defaults from the
// marketing spec; overridable per-event-type via GadsConfig.valueMap (Settings),
// so it can be tuned without a deploy. The Booking-Confirmed conversion uses the
// ACTUAL bookingValue, never this table.
// ============================================================

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type EventBucket = "WEDDING" | "CORPORATE" | "ENGAGEMENT" | "BIRTHDAY" | "OTHER";

export const DEFAULT_QL_VALUE: Record<EventBucket, number> = {
  WEDDING: 35000,
  CORPORATE: 15000,
  ENGAGEMENT: 9600,
  BIRTHDAY: 6000,
  OTHER: 6000,
};

export const EVENT_BUCKET_LABEL: Record<EventBucket, string> = {
  WEDDING: "Wedding / Reception",
  CORPORATE: "Corporate / Conference",
  ENGAGEMENT: "Engagement / Naming ceremony",
  BIRTHDAY: "Birthday / Small party",
  OTHER: "Other / unknown",
};

/** Map the lead's free-text eventType into a value bucket. */
export function bucketEventType(eventType?: string | null): EventBucket {
  const t = (eventType || "").toLowerCase();
  if (/wedding|reception|sangeet|mehndi|nikah|muhurth/.test(t)) return "WEDDING";
  if (/corporate|conference|gala|product\s*launch|seminar|meeting|annual/.test(t)) return "CORPORATE";
  if (/engagement|naming|betroth|cradle|house\s*warming|griha/.test(t)) return "ENGAGEMENT";
  if (/birthday|party|anniversary|baby\s*shower|get.?together|small/.test(t)) return "BIRTHDAY";
  return "OTHER";
}

export async function getGadsConfig() {
  try {
    return await prisma.gadsConfig.findUnique({ where: { id: "singleton" } });
  } catch {
    return null;
  }
}

/** Effective ₹/qualified-lead value: config override for the bucket, else default. */
export function qualifiedLeadValue(
  eventType: string | null | undefined,
  valueMap?: unknown
): number {
  const bucket = bucketEventType(eventType);
  const map =
    valueMap && typeof valueMap === "object" ? (valueMap as Record<string, unknown>) : null;
  const override = map ? Number(map[bucket]) : NaN;
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_QL_VALUE[bucket];
}

/** The full effective value map (defaults merged with the config override). */
export function effectiveValueMap(valueMap?: unknown): Record<EventBucket, number> {
  const map =
    valueMap && typeof valueMap === "object" ? (valueMap as Record<string, unknown>) : {};
  const out = { ...DEFAULT_QL_VALUE };
  (Object.keys(DEFAULT_QL_VALUE) as EventBucket[]).forEach((k) => {
    const v = Number(map[k]);
    if (Number.isFinite(v) && v > 0) out[k] = v;
  });
  return out;
}

/**
 * Format an instant as Google's required offline-conversion timestamp, in IST:
 *   `yyyy-MM-dd HH:mm:ss+05:30`   (the +05:30 offset is mandatory)
 */
export function toGoogleIstTimestamp(date: Date): string {
  // IST is a fixed +5:30; shift the UTC instant and read the components.
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${ist.getUTCFullYear()}-${p(ist.getUTCMonth() + 1)}-${p(ist.getUTCDate())} ` +
    `${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}:${p(ist.getUTCSeconds())}+05:30`
  );
}

/** Google will not accept a conversion whose click is older than 90 days. */
export const CLICK_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Authorize an offline-conversion API call. The service key lives in GadsConfig
 * (Settings) with an env fallback. Accepts `Authorization: Bearer <key>` or
 * `X-API-Key: <key>`. Fail-closed when no key is configured.
 */
export async function isAuthorizedOfflineApi(
  authHeader: string | null,
  apiKeyHeader: string | null
): Promise<boolean> {
  const config = await getGadsConfig();
  const expected = config?.offlineApiKey || process.env.GADS_OFFLINE_API_KEY || "";
  if (!expected) return false;
  const provided = (
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : apiKeyHeader || ""
  ).trim();
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
