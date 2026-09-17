// ============================================================
// Push API configuration — read from the environment on every call.
//
// Read lazily rather than at import time so a test (or an operator changing a
// limit) is honoured without re-importing, and so a malformed value falls back
// to the documented default instead of throwing inside a request.
// ============================================================

function intEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

export interface PushApiConfig {
  enabled: boolean;
  ratePerMinute: number;
  ratePerHour: number;
  /** Seconds an Idempotency-Key is remembered. */
  idempotencyTtlSeconds: number;
  maxBodyBytes: number;
  /** Browser origins allowed to call the API. Empty = server-to-server only. */
  allowedOrigins: string[];
  /** Hours within which a push for the same phone/email updates the open lead instead of creating another. */
  dedupWindowHours: number;
  logRetentionDays: number;
  /** New leads one key may create per UTC day — a brake on a leaked or runaway integration. */
  maxNewLeadsPerDay: number;
  /** Failed authentication attempts one IP may make per minute before it is refused outright. */
  failedAuthPerMinute: number;
  /** Seconds an in-flight Idempotency-Key claim is honoured before a retry may take it over. */
  idempotencyLeaseSeconds: number;
  /** Days an internal event is kept in the outbox. */
  eventRetentionDays: number;
  /**
   * Reject requests whose X-Forwarded-Proto says "http". Only meaningful when
   * the web server in front of the app SETS that header from the real client
   * connection. Off by default: Apache here doesn't set it, and Next.js then
   * fills it with "http" from its own local connection — which made every
   * genuine HTTPS request look like plain HTTP.
   */
  trustForwardedProto: boolean;
}

export function pushApiConfig(): PushApiConfig {
  return {
    // On unless explicitly switched off: every request still needs a scoped key.
    enabled: (process.env.PUSH_API_ENABLED ?? "true").trim().toLowerCase() !== "false",
    ratePerMinute: intEnv("PUSH_API_RATE_LIMIT_PER_MINUTE", 100),
    ratePerHour: intEnv("PUSH_API_RATE_LIMIT_PER_HOUR", 1000),
    idempotencyTtlSeconds: intEnv("PUSH_API_IDEMPOTENCY_TTL", 86_400, 60),
    maxBodyBytes: intEnv("PUSH_API_MAX_BODY_BYTES", 64 * 1024, 1024),
    allowedOrigins: (process.env.PUSH_API_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean),
    dedupWindowHours: intEnv("PUSH_API_DEDUP_WINDOW_HOURS", 24),
    logRetentionDays: intEnv("PUSH_API_LOG_RETENTION_DAYS", 90),
    maxNewLeadsPerDay: intEnv("PUSH_API_MAX_NEW_LEADS_PER_DAY", 2000),
    failedAuthPerMinute: intEnv("PUSH_API_FAILED_AUTH_PER_MINUTE", 30),
    idempotencyLeaseSeconds: intEnv("PUSH_API_IDEMPOTENCY_LEASE_SECONDS", 120, 10),
    eventRetentionDays: intEnv("PUSH_API_EVENT_RETENTION_DAYS", 90),
    trustForwardedProto: (process.env.PUSH_API_TRUST_FORWARDED_PROTO ?? "false").trim().toLowerCase() === "true",
  };
}

export const PUSH_API_VERSION = "1.0.0";
export const PUSH_API_SERVICE = "veloria-push-api";
