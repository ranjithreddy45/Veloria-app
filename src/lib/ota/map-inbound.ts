// ============================================================
// OTA Inbound payload mapper
// ============================================================
// Maps an arbitrary aggregator payload onto the ExternalLeadData shape that
// captureLeadFromExternal() consumes, using the admin-authored OtaChannel
// fieldMapping (canonical field -> dot-path into the raw payload).
//
// This module is intentionally pure (no DB, no auth) so the public inbound
// route can call it deterministically and the config UI can preview mappings.

import type { Prisma } from "@prisma/client";

// The exact shape captureLeadFromExternal() accepts (src/lib/lead-capture.ts).
// Kept structurally compatible; the inbound route passes this straight through.
export interface MappedLead {
  name: string;
  email?: string;
  phone?: string;
  source: string;
  message?: string;
  eventType?: string;
  eventDate?: string;
  guestCount?: number;
  estimatedValue?: number;
  perPlateBudget?: number;
  venueId?: string;
  customFields?: Record<string, unknown>;
  externalId?: string;
}

export type MapInboundResult =
  | { ok: true; data: MappedLead }
  | { ok: false; error: string };

/**
 * Safe dot-path lookup. Supports "a.b.c" and array indices "items.0.id".
 * Returns undefined for any missing / non-traversable segment.
 */
function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const segments = path.split(".");
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function toStringOrUndef(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function toNumberOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Apply the channel's fieldMapping to a raw payload.
 *
 * Recognised canonical keys (any subset may be mapped):
 *   name, email, phone, message, eventType, eventDate, guestCount,
 *   estimatedValue, perPlateBudget, venueId, id
 *
 * `id` is used to derive a stable externalId for idempotency. If absent, we
 * fall back to a deterministic hash of phone+eventDate so aggregator retries
 * that omit an id still dedupe rather than minting duplicate leads.
 *
 * Returns { ok:false } when neither name nor phone can be resolved (the lead
 * would be useless) — the caller logs this as PARTIAL/FAILED for observability.
 */
export function mapInboundToLead(
  payload: unknown,
  fieldMapping: Prisma.JsonValue | Record<string, string> | null | undefined,
  defaultSource: string,
  channelId: string
): MapInboundResult {
  const mapping: Record<string, string> =
    fieldMapping && typeof fieldMapping === "object" && !Array.isArray(fieldMapping)
      ? (fieldMapping as Record<string, string>)
      : {};

  const resolve = (key: string): unknown =>
    mapping[key] ? getByPath(payload, mapping[key]) : undefined;

  const name = toStringOrUndef(resolve("name"));
  const phone = toStringOrUndef(resolve("phone"));
  const email = toStringOrUndef(resolve("email"));

  // A lead with no name AND no phone is not actionable — fail closed.
  if (!name && !phone) {
    return {
      ok: false,
      error:
        "Could not resolve name or phone from payload using the channel field mapping",
    };
  }

  const eventDate = toStringOrUndef(resolve("eventDate"));
  const aggregatorId = toStringOrUndef(resolve("id"));

  // Stable idempotency key. Prefer the aggregator's own id; else hash phone+date.
  const idBasis = aggregatorId ?? `${phone ?? ""}|${eventDate ?? ""}`;
  const externalId = `ota:${channelId}:${stableKey(idBasis)}`;

  const data: MappedLead = {
    name: name ?? phone ?? "OTA Lead",
    email,
    phone,
    source: defaultSource,
    message: toStringOrUndef(resolve("message")),
    eventType: toStringOrUndef(resolve("eventType")),
    eventDate,
    guestCount: toNumberOrUndef(resolve("guestCount")),
    estimatedValue: toNumberOrUndef(resolve("estimatedValue")),
    perPlateBudget: toNumberOrUndef(resolve("perPlateBudget")),
    venueId: toStringOrUndef(resolve("venueId")),
    externalId,
  };

  return { ok: true, data };
}

/**
 * Tiny, dependency-free deterministic string key (djb2). Not cryptographic —
 * only needs to be stable so the same payload produces the same externalId.
 */
function stableKey(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  // Unsigned hex.
  return (hash >>> 0).toString(16);
}
