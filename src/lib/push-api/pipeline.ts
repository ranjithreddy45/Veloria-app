import { NextResponse } from "next/server";
import { pushApiConfig, type PushApiConfig } from "./config";
import { PushApiError } from "./errors";
import { clientIp, corsHeaders, errorBody, pushJson } from "./http";
import { newRequestId } from "./request-id";
import { authenticatePushRequest, type AuthenticatedKey } from "./auth";
import { consumeRateLimit } from "./rate-limit";
import { readJsonObject } from "./body";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
  requestHash,
} from "./idempotency";
import { recordPushRequest, type PushOutcome } from "./audit";
import type { PushScope } from "./keys";

// ============================================================
// The request pipeline every /api/v1/push/* endpoint runs through:
//
//   request id → enabled? → authenticate → rate limit → read body
//     → validate → idempotency → process → store idempotent result → audit
//
// An endpoint only supplies how to validate its body and what to do with a
// valid one. Authentication, limits, replay protection, error shapes and the
// audit trail are identical for leads today and bookings or calls tomorrow.
// ============================================================

export interface ProcessContext {
  apiKey: AuthenticatedKey;
  requestId: string;
  config: PushApiConfig;
}

export interface ProcessResult {
  status: number;
  body: Record<string, unknown>;
  outcome: PushOutcome;
  resourceType?: string;
  resourceId?: string;
}

export interface PushEndpoint<T> {
  endpoint: string;
  scope: PushScope;
  parse(body: Record<string, unknown>): { ok: true; value: T } | { ok: false; fields: Record<string, string> };
  process(value: T, ctx: ProcessContext): Promise<ProcessResult>;
  /** Identifiers worth putting in the audit row before processing finishes (or fails). */
  describe(value: T): { source?: string; externalId?: string };
  /** The response for a retried Idempotency-Key, built from the response stored the first time. */
  replay(stored: Record<string, unknown>, requestId: string): { status: number; body: Record<string, unknown> };
}

export function createPushEndpoint<T>(def: PushEndpoint<T>) {
  async function POST(req: Request): Promise<NextResponse> {
    const started = performance.now();
    const requestId = newRequestId();
    const cors = corsHeaders(req.headers.get("origin"));
    const config = pushApiConfig();

    let apiKey: AuthenticatedKey | null = null;
    let rateHeaders: Record<string, string> = {};
    let described: { source?: string; externalId?: string } = {};
    let claimId: string | null = null;

    const finish = async (
      status: number,
      body: Record<string, unknown>,
      audit: { outcome: PushOutcome; errorCode?: string; leadId?: string | null },
      extraHeaders: Record<string, string> = {}
    ) => {
      await recordPushRequest({
        requestId,
        endpoint: def.endpoint,
        method: "POST",
        apiKeyId: apiKey?.id,
        apiKeyPrefix: apiKey?.prefix,
        source: described.source ?? apiKey?.source,
        ip: clientIp(req.headers),
        userAgent: req.headers.get("user-agent"),
        outcome: audit.outcome,
        responseStatus: status,
        errorCode: audit.errorCode,
        leadId: audit.leadId,
        externalId: described.externalId,
        durationMs: performance.now() - started,
      });
      return pushJson(status, body, requestId, { ...cors, ...rateHeaders, ...extraHeaders });
    };

    try {
      if (!config.enabled) {
        throw new PushApiError("PUSH_API_DISABLED", "The Push API is currently disabled.");
      }

      apiKey = await authenticatePushRequest(req.headers, def.scope);
      rateHeaders = (
        await consumeRateLimit(apiKey.id, { perMinute: config.ratePerMinute, perHour: config.ratePerHour })
      ).headers;

      const raw = await readJsonObject(req, config.maxBodyBytes);
      const parsed = def.parse(raw);
      if (!parsed.ok) {
        throw new PushApiError("VALIDATION_ERROR", "Invalid request", parsed.fields);
      }
      described = def.describe(parsed.value);

      const idempotencyKey = req.headers.get("idempotency-key");
      if (idempotencyKey != null) {
        const claim = await claimIdempotencyKey({
          apiKeyId: apiKey.id,
          key: idempotencyKey.trim(),
          hash: requestHash(raw),
          ttlSeconds: config.idempotencyTtlSeconds,
        });
        if (claim.kind === "replay") {
          const replayed = def.replay((claim.body ?? {}) as Record<string, unknown>, requestId);
          const data = (claim.body as { data?: { lead_id?: string } } | null)?.data;
          return await finish(
            replayed.status,
            replayed.body,
            { outcome: "replayed", leadId: data?.lead_id ?? null },
            { "Idempotent-Replayed": "true" }
          );
        }
        claimId = claim.recordId;
      }

      const result = await def.process(parsed.value, { apiKey, requestId, config });

      if (claimId) {
        const recordId = claimId;
        // The work is done from here on, so nothing below may release the key or
        // turn a saved lead into a 500. If storing the result fails, a retry is
        // still caught by the external-id and same-contact dedup.
        claimId = null;
        await completeIdempotencyKey(recordId, {
          status: result.status,
          body: result.body,
          resourceType: result.resourceType,
          resourceId: result.resourceId,
        }).catch((err) =>
          console.error(
            JSON.stringify({ level: "error", event: "push_api_idempotency_store_failed", request_id: requestId, error: String(err) })
          )
        );
      }
      return await finish(result.status, result.body, { outcome: result.outcome, leadId: result.resourceId });
    } catch (e) {
      // A failed first attempt must not lock its Idempotency-Key: release it so the retry runs.
      if (claimId) await releaseIdempotencyKey(claimId).catch(() => {});

      if (e instanceof PushApiError) {
        return finish(
          e.status,
          errorBody(e, requestId),
          { outcome: "rejected", errorCode: e.code },
          e.headers ?? {}
        );
      }

      // Server-side detail goes to the log, keyed by request id — never to the client.
      console.error(
        JSON.stringify({
          level: "error",
          event: "push_api_unhandled",
          request_id: requestId,
          endpoint: def.endpoint,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        })
      );
      const internal = new PushApiError(
        "INTERNAL_ERROR",
        "Something went wrong on our side. Quote the request_id if you contact us."
      );
      return finish(internal.status, errorBody(internal, requestId), { outcome: "error", errorCode: internal.code });
    }
  }

  async function OPTIONS(req: Request): Promise<NextResponse> {
    // A 204 must have no body. Without an allow-listed Origin the preflight
    // carries no CORS headers, so the browser refuses the real request.
    return new NextResponse(null, {
      status: 204,
      headers: { ...corsHeaders(req.headers.get("origin")), "X-Request-ID": newRequestId(), "Cache-Control": "no-store" },
    });
  }

  return { POST, OPTIONS };
}
