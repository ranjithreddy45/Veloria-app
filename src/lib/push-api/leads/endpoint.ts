import { createPushEndpoint } from "../pipeline";
import { parsePushLead, type PushLead } from "./schema";
import { ingestPushLead } from "./ingest";

// ============================================================
// POST /api/v1/push/leads — the lead-specific pieces handed to the shared
// Push API pipeline.
// ============================================================

export const pushLeadsEndpoint = createPushEndpoint<PushLead>({
  endpoint: "/api/v1/push/leads",
  scope: "leads:create",

  parse(body) {
    const parsed = parsePushLead(body);
    return parsed.ok ? { ok: true, value: parsed.lead } : { ok: false, fields: parsed.fields };
  },

  describe(lead) {
    return { source: lead.source, externalId: lead.externalId };
  },

  async process(lead, ctx) {
    const result = await ingestPushLead(lead, {
      apiKeyId: ctx.apiKey.id,
      lineageId: ctx.apiKey.lineageId,
      scopes: ctx.apiKey.scopes,
      requestId: ctx.requestId,
      dedupWindowHours: ctx.config.dedupWindowHours,
      maxNewLeadsPerDay: ctx.config.maxNewLeadsPerDay,
    });

    if (result.created) {
      return {
        status: 201,
        outcome: "created",
        resourceType: "Lead",
        resourceId: result.leadId,
        body: {
          success: true,
          message: "Lead created successfully",
          request_id: ctx.requestId,
          data: {
            lead_id: result.leadId,
            external_id: lead.externalId ?? null,
            status: result.status,
            created: true,
            duplicate: false,
          },
        },
      };
    }

    return {
      status: 200,
      outcome: result.updatedFields.length > 0 ? "updated" : "duplicate",
      resourceType: "Lead",
      resourceId: result.leadId,
      body: {
        success: true,
        // Always exactly this message; `updated_fields` says what, if anything, was filled in.
        message: "Lead already exists",
        request_id: ctx.requestId,
        data: {
          lead_id: result.leadId,
          external_id: lead.externalId ?? null,
          status: result.status,
          created: false,
          duplicate: true,
          matched_by: result.matchedBy,
          updated_fields: result.updatedFields,
        },
      },
    };
  },

  // A retried Idempotency-Key never creates anything, so it always answers 200
  // "already exists", pointing at the lead the first request produced.
  replay(stored, requestId) {
    const data = (stored.data ?? {}) as Record<string, unknown>;
    return {
      status: 200,
      body: {
        success: true,
        message: "Lead already exists",
        request_id: requestId,
        data: {
          lead_id: data.lead_id ?? null,
          external_id: data.external_id ?? null,
          status: data.status ?? null,
          created: false,
          duplicate: true,
          matched_by: "idempotency_key",
          updated_fields: [],
        },
      },
    };
  },
});
