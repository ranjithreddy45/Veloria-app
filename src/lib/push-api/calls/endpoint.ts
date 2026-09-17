import { createPushEndpoint } from "../pipeline";
import { parsePushCall, type PushCall } from "./schema";
import { CALLVIBE_PUSH_SOURCE, recordPushCall } from "./record";

// ============================================================
// POST /api/v1/push/call-activity — a call that happened with a lead, handed
// to the shared Push API pipeline (auth, limits, idempotency, audit).
//
//   201  no lead matched, so one was created and the call attached to it
//   200  the call was attached to an existing lead, or was already recorded
// ============================================================

export const pushCallActivityEndpoint = createPushEndpoint<PushCall>({
  endpoint: "/api/v1/push/call-activity",
  scope: "calls:create",

  parse(body) {
    const parsed = parsePushCall(body);
    return parsed.ok ? { ok: true, value: parsed.call } : { ok: false, fields: parsed.fields };
  },

  // Calls always come from CallVibe, so a key bound to another source can't send them.
  describe(call) {
    return { source: CALLVIBE_PUSH_SOURCE, externalId: call.externalCallId };
  },

  async process(call, ctx) {
    const result = await recordPushCall(call, {
      apiKeyId: ctx.apiKey.id,
      lineageId: ctx.apiKey.lineageId,
      scopes: ctx.apiKey.scopes,
      requestId: ctx.requestId,
      dedupWindowHours: ctx.config.dedupWindowHours,
      maxNewLeadsPerDay: ctx.config.maxNewLeadsPerDay,
    });
    const created = result.leadCreated;
    return {
      status: created ? 201 : 200,
      outcome: created ? "created" : result.duplicate ? "duplicate" : "updated",
      resourceType: "Lead",
      resourceId: result.leadId ?? undefined,
      body: {
        success: true,
        message: result.duplicate
          ? "Call already recorded"
          : created
            ? "Lead created and call recorded"
            : "Call recorded",
        request_id: ctx.requestId,
        data: {
          call_id: result.callId,
          lead_id: result.leadId,
          contact_id: result.contactId,
          external_call_id: call.externalCallId,
          lead_created: created,
          duplicate: result.duplicate,
          matched_by: result.matchedBy,
        },
      },
    };
  },

  // A retried Idempotency-Key never records anything: 200, pointing at what the first request recorded.
  replay(stored, requestId) {
    const data = (stored.data ?? {}) as Record<string, unknown>;
    return {
      status: 200,
      body: {
        success: true,
        message: "Call already recorded",
        request_id: requestId,
        data: {
          call_id: data.call_id ?? null,
          lead_id: data.lead_id ?? null,
          contact_id: data.contact_id ?? null,
          external_call_id: data.external_call_id ?? null,
          lead_created: false,
          duplicate: true,
          matched_by: "idempotency_key",
        },
      },
    };
  },
});
