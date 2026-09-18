import { prisma } from "@/lib/prisma";
import { hashIp } from "@/lib/quote-radar/token";

// ============================================================
// One audit row and one structured log line per Push API request.
//
// What is recorded is the list the integration spec asks for. What is NOT
// recorded is deliberate: no request body, no Authorization header, no phone
// number, email or name, and the client IP only as a salted hash. The lead id
// and external id are enough to find everything else from inside the CRM.
// ============================================================

export type PushOutcome = "created" | "updated" | "duplicate" | "replayed" | "rejected" | "error";

export interface PushAuditEntry {
  requestId: string;
  endpoint: string;
  method: string;
  apiKeyId?: string | null;
  apiKeyPrefix?: string | null;
  source?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  outcome: PushOutcome;
  responseStatus: number;
  errorCode?: string | null;
  leadId?: string | null;
  externalId?: string | null;
  durationMs: number;
}

export function structuredLogLine(entry: PushAuditEntry): string {
  return JSON.stringify({
    level: entry.responseStatus >= 500 ? "error" : entry.responseStatus >= 400 ? "warn" : "info",
    event: "push_api_request",
    request_id: entry.requestId,
    endpoint: entry.endpoint,
    method: entry.method,
    api_key_id: entry.apiKeyId ?? null,
    source: entry.source ?? null,
    outcome: entry.outcome,
    status_code: entry.responseStatus,
    error_code: entry.errorCode ?? null,
    lead_id: entry.leadId ?? null,
    external_id: entry.externalId ?? null,
    duration_ms: entry.durationMs,
  });
}

/** Never throws: a request that succeeded must not turn into a 500 because its audit row didn't save. */
export async function recordPushRequest(entry: PushAuditEntry): Promise<void> {
  const line = structuredLogLine(entry);
  if (entry.responseStatus >= 500) console.error(line);
  else console.log(line);

  try {
    await prisma.pushApiRequestLog.create({
      data: {
        requestId: entry.requestId,
        endpoint: entry.endpoint,
        method: entry.method,
        apiKeyId: entry.apiKeyId ?? null,
        apiKeyPrefix: entry.apiKeyPrefix ?? null,
        source: entry.source?.slice(0, 100) ?? null,
        ipHash: hashIp(entry.ip, process.env.PUSH_API_IP_SALT ?? process.env.QUOTE_VIEW_IP_SALT),
        userAgent: entry.userAgent?.slice(0, 300) ?? null,
        outcome: entry.outcome,
        responseStatus: entry.responseStatus,
        errorCode: entry.errorCode ?? null,
        leadId: entry.leadId ?? null,
        externalId: entry.externalId?.slice(0, 200) ?? null,
        durationMs: Math.max(0, Math.round(entry.durationMs)),
      },
    });
  } catch (e) {
    console.error(
      JSON.stringify({ level: "error", event: "push_api_audit_write_failed", request_id: entry.requestId, error: String(e) })
    );
  }
}
