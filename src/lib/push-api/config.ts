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
  };
}

export const PUSH_API_VERSION = "1.0.0";
export const PUSH_API_SERVICE = "veloria-push-api";
