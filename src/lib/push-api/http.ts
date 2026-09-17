import { NextResponse } from "next/server";
import { pushApiConfig } from "./config";
import type { PushApiError } from "./errors";

// ============================================================
// Response helpers. Every Push API response — success, error, preflight —
// goes through here, so X-Request-ID and the security headers can't be missed.
// ============================================================

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/**
 * CORS headers for an allow-listed browser origin, or none at all.
 *
 * This API is server-to-server: an ad platform, a CRM, our website's backend.
 * A browser has no business holding a push key, so the default is to send no
 * Access-Control-Allow-Origin whatsoever — never "*".
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  const allowed = pushApiConfig().allowedOrigins;
  if (!allowed.includes(origin.replace(/\/+$/, ""))) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
    "Access-Control-Expose-Headers":
      "X-Request-ID, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function pushJson(
  status: number,
  body: unknown,
  requestId: string,
  headers: Record<string, string> = {}
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { ...SECURITY_HEADERS, ...headers, "X-Request-ID": requestId },
  });
}

export function errorBody(err: PushApiError, requestId: string) {
  return {
    success: false as const,
    error: {
      code: err.code,
      message: err.message,
      ...(err.fields ? { fields: err.fields } : {}),
    },
    request_id: requestId,
  };
}

/**
 * The client IP, as our own proxy saw it. Only ever stored hashed.
 *
 * X-Forwarded-For is a list that every hop APPENDS to, and a client can send
 * the header already filled in with whatever it likes. Only the LAST entry was
 * written by our proxy (Apache, which resolves the real client behind
 * Cloudflare), so that is the only one we trust. Taking the first would let
 * any caller choose the address we record and throttle.
 */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
    return hops.length ? hops[hops.length - 1]! : null;
  }
  return headers.get("x-real-ip")?.trim() || null;
}

/**
 * False only when a proxy tells us the request arrived over plain HTTP.
 * Apache/Cloudflare terminate TLS and set X-Forwarded-Proto; with no header at
 * all (a direct local call) there is nothing to judge, so it is allowed.
 */
export function arrivedOverHttps(headers: Headers): boolean {
  const proto = headers.get("x-forwarded-proto");
  if (!proto) return true;
  return proto.split(",")[0]!.trim().toLowerCase() === "https";
}
