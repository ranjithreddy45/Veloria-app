// ============================================================
// Inbound / missed-ring telephony parser.
//
// The existing src/lib/telephony.ts adapters are purpose-built for OUTBOUND
// status callbacks: their parseWebhook coerces an unknown status to
// "completed" and reads `From` as the AGENT number. For an INBOUND ring we
// instead need the CALLER's number, so this small wrapper:
//   1. reuses getTelephonyAdapter(config).parseWebhook(body) to pull a
//      provider-mapped externalCallId (and a best-effort `from`), then
//   2. overlays an inbound-specific caller-number resolution that reads the
//      provider's actual caller field (CallFrom / customer_number / caller_id
//      …), falling back to generic fields so a plain IVR POST also works.
//
// Returns null only when no caller number is resolvable at all (we cannot
// rescue a ring we can't attribute to a phone number). Never throws.
// ============================================================

import { getTelephonyAdapter, type TelephonyWebhookEvent } from "@/lib/telephony";

export type InboundProvider = "EXOTEL" | "KNOWLARITY" | "MYOPERATOR" | "IVR";

export interface InboundRing {
  /** Provider call id when present — the idempotency key for redeliveries. */
  externalCallId: string | null;
  /** The customer's (caller's) phone number, raw as the provider sent it. */
  callerPhone: string;
  /** Raw provider status string, lower-cased, if any (e.g. "missed"). */
  status: string | null;
}

/** Minimal config shape the adapter factory needs. */
interface TelephonyConfigLike {
  provider: string;
  apiKey: string;
  apiSecret?: string | null;
  accountSid?: string | null;
  subdomain?: string | null;
  callerId: string;
}

/** Pull a string field from a plain object, trying several candidate keys. */
function pickString(
  data: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const v = data[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

/**
 * Resolve the CALLER number for an inbound ring directly from the provider
 * payload. For inbound flows providers carry the customer number in a
 * dedicated field that differs from the outbound `From`/agent mapping:
 *   - Exotel:      CallFrom (the dialing customer), From as fallback
 *   - Knowlarity:  customer_number / caller_id
 *   - MyOperator:  caller_number / customer_number / from
 *   - Generic IVR: CallFrom / From / caller_number / customer_number / msisdn
 */
function resolveCallerPhone(
  provider: InboundProvider,
  data: Record<string, unknown>
): string | null {
  const generic = [
    "CallFrom",
    "callFrom",
    "call_from",
    "From",
    "from",
    "caller_number",
    "callerNumber",
    "customer_number",
    "customerNumber",
    "caller_id",
    "callerId",
    "msisdn",
    "phone",
    "number",
  ];

  switch (provider) {
    case "EXOTEL":
      return pickString(data, ["CallFrom", "From", "from", ...generic]);
    case "KNOWLARITY":
      return pickString(data, [
        "customer_number",
        "caller_id",
        "caller_number",
        ...generic,
      ]);
    case "MYOPERATOR":
      return pickString(data, [
        "caller_number",
        "customer_number",
        "from",
        ...generic,
      ]);
    case "IVR":
    default:
      return pickString(data, generic);
  }
}

/** Resolve a provider call id for inbound rings (idempotency key). */
function resolveExternalCallId(
  data: Record<string, unknown>,
  adapterEvent: TelephonyWebhookEvent | null
): string | null {
  if (adapterEvent?.externalCallId) return adapterEvent.externalCallId;
  return pickString(data, [
    "CallSid",
    "Sid",
    "call_id",
    "callId",
    "uuid",
    "id",
    "conversation_uuid",
  ]);
}

/** Resolve a raw status string for inbound rings (best-effort, lower-cased). */
function resolveStatus(data: Record<string, unknown>): string | null {
  const s = pickString(data, [
    "Status",
    "CallStatus",
    "status",
    "call_status",
    "DialCallStatus",
    "event",
  ]);
  return s ? s.toLowerCase() : null;
}

/**
 * Parse an inbound/missed-ring webhook body into { externalCallId, callerPhone,
 * status }. Reuses the provider adapter for externalCallId field-mapping where
 * possible, then overlays inbound-specific caller resolution. Returns null when
 * no caller number can be resolved.
 */
export function parseInboundRing(
  provider: InboundProvider,
  config: TelephonyConfigLike,
  body: unknown
): InboundRing | null {
  try {
    const data =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};

    // Best-effort reuse of the existing adapter for externalCallId mapping.
    // It may return null for inbound shapes (no CallSid on a missed-call
    // ping) — that's fine, we fall back to direct field resolution below.
    let adapterEvent: TelephonyWebhookEvent | null = null;
    if (provider !== "IVR") {
      try {
        adapterEvent = getTelephonyAdapter(config).parseWebhook(body);
      } catch {
        adapterEvent = null;
      }
    }

    const callerPhone = resolveCallerPhone(provider, data);
    if (!callerPhone) return null;

    return {
      externalCallId: resolveExternalCallId(data, adapterEvent),
      callerPhone,
      status: resolveStatus(data),
    };
  } catch {
    return null;
  }
}
