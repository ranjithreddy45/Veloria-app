import { PUSH_API_VERSION } from "./config";

// ============================================================
// OpenAPI 3.1 description of the Push API, served at /api/v1/openapi.json and
// rendered at /api/v1/docs. openapi.test.ts fails if a field is accepted by the
// validator but missing here (or documented but not accepted).
// ============================================================

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: "string", description, ...extra });

export const LEAD_REQUEST_PROPERTIES: Record<string, Record<string, unknown>> = {
  external_id: str("Your own id for this lead. With `source`, the primary deduplication key.", { maxLength: 200, example: "META-987654" }),
  source: str(
    "Where the lead came from, as a slug. Known values map to the CRM's lead source; any other slug is accepted and stored as OTHER.",
    {
      pattern: "^[a-z0-9][a-z0-9_:.-]{0,49}$",
      examples: ["website", "google_ads", "meta_ads", "linkedin_ads", "whatsapp", "instagram", "walk_in", "phone", "referral", "partner", "api"],
      example: "meta_ads",
    }
  ),
  name: str("Full name.", { maxLength: 200, example: "Rahul Sharma" }),
  phone: str(
    "Phone number. Indian mobiles are accepted in any common format (9876543210, 919876543210, +91 98765 43210) and stored as +919876543210. Other countries need the +country code. Deduplication compares the full number including its country code.",
    { example: "+919876543210" }
  ),
  email: str("Email address. Stored lowercase.", { format: "email", maxLength: 254, example: "rahul@example.com" }),
  event_type: str("Kind of event.", { maxLength: 100, example: "wedding" }),
  event_date: str(
    "Event date: `YYYY-MM-DD`, or a full ISO 8601 date-time with a valid time (`HH:MM`, `HH:MM:SS` or `HH:MM:SS.sss`, optionally followed by `Z` or `±HH:MM`). The calendar date as written is stored; no time-zone conversion is applied.",
    {
      pattern: "^\\d{4}-\\d{2}-\\d{2}(T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?(Z|[+-]\\d{2}:\\d{2})?)?$",
      examples: ["2026-12-20", "2026-12-20T18:30:00+05:30"],
      example: "2026-12-20",
    }
  ),
  guest_count: { type: "integer", minimum: 1, maximum: 100000, description: "Expected guests.", example: 250 },
  venue: str("Preferred hall, by name. Linked when it matches an active hall exactly (case-insensitive).", {
    maxLength: 200,
    example: "Blossom Bellandur",
  }),
  budget: { type: "number", exclusiveMinimum: 0, maximum: 9999999999, description: "Budget in rupees.", example: 250000 },
  message: str("Free-text message from the enquirer.", { maxLength: 5000 }),
  medium: str("Marketing medium.", { maxLength: 100, example: "paid_social" }),
  campaign: str("Campaign name.", { maxLength: 200, example: "Blossom Bellandur Wedding Campaign" }),
  campaign_id: str("Ad-platform campaign id.", { maxLength: 100, example: "123456789" }),
  adset: str("Ad set / ad group name.", { maxLength: 200, example: "Wedding Leads" }),
  adset_id: str("Ad set / ad group id.", { maxLength: 100 }),
  ad_id: str("Ad id.", { maxLength: 100, example: "987654321" }),
  creative: str("Creative name.", { maxLength: 200 }),
  keyword: str("Search keyword.", { maxLength: 200 }),
  utm_source: str("utm_source.", { maxLength: 200, example: "facebook" }),
  utm_medium: str("utm_medium.", { maxLength: 200, example: "paid_social" }),
  utm_campaign: str("utm_campaign.", { maxLength: 200, example: "blossom_wedding" }),
  utm_term: str("utm_term.", { maxLength: 200 }),
  utm_content: str("utm_content.", { maxLength: 200, example: "video_01" }),
  landing_page: str("Landing page URL.", { format: "uri", maxLength: 2000, example: "https://veloriagrand.com/blossom-bellandur.html" }),
  referrer_url: str("Referring page URL.", { format: "uri", maxLength: 2000 }),
  gclid: str("Google click id — enables Google Ads offline conversion upload.", { maxLength: 200 }),
  gbraid: str("Google gbraid.", { maxLength: 200 }),
  wbraid: str("Google wbraid.", { maxLength: 200 }),
  fbclid: str("Meta click id.", { maxLength: 255 }),
  consent: {
    type: "boolean",
    description:
      "Whether the enquirer consented to be contacted. `true` is recorded against the contact (if not already recorded). A new lead's automatic WhatsApp welcome message is only sent when this is `true`.",
  },
  metadata: {
    type: "object",
    additionalProperties: true,
    description:
      "Any extra parameters. Stored as JSON on the lead's touch record. At most 50 keys, 3 levels deep and 8 KB; anything larger or deeper is rejected with 422.",
    example: { fb_lead_id: "123456789", device: "mobile", landing_page_variant: "B" },
  },
};

const errorResponse = (description: string, code: string, message: string, extra: Record<string, unknown> = {}) => ({
  description,
  headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      example: { success: false, error: { code, message, ...extra }, request_id: "req_01J8ZQ4X7B5N2K9M3P6R8T0V1W" },
    },
  },
});

/** One status that can carry several error codes: documented with an OpenAPI `examples` map, one entry per code. */
const multiErrorResponse = (
  description: string,
  cases: { code: string; summary: string; message: string }[],
  headers: Record<string, unknown> = {}
) => ({
  description,
  headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" }, ...headers },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      examples: Object.fromEntries(
        cases.map((c) => [
          c.code,
          {
            summary: c.summary,
            value: { success: false, error: { code: c.code, message: c.message }, request_id: "req_01J8ZQ4X7B5N2K9M3P6R8T0V1W" },
          },
        ])
      ),
    },
  },
});

const SAMPLE_BODY = {
  external_id: "META-123456",
  source: "meta_ads",
  name: "Rahul Sharma",
  phone: "+919876543210",
  email: "rahul@example.com",
  guest_count: 250,
  event_type: "wedding",
  consent: true,
};

export function buildOpenApiDocument(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Veloria Grand Push API",
      version: PUSH_API_VERSION,
      description: [
        "Push leads from authorised external systems (ad platforms, the website, partners) into the Veloria Grand CRM.",
        "",
        "**HTTPS only.** A request that reaches the server over plain HTTP is refused with `403 HTTPS_REQUIRED`.",
        "",
        "**Authentication.** `Authorization: Bearer vg_live_…`. Keys are issued in Settings → Integrations → Lead Capture and shown once. A key must be granted `leads:create`; `leads:update` additionally lets a repeat push fill in an existing lead. `401 UNAUTHORIZED` = key missing or unknown. `403 API_KEY_REVOKED`, `403 API_KEY_EXPIRED`, `403 INSUFFICIENT_SCOPE`; `403 SOURCE_NOT_ALLOWED` when the key was issued for a source and the body's `source` is different. Too many failed authentication attempts from one IP address return `429 TOO_MANY_FAILED_ATTEMPTS` with `Retry-After`.",
        "",
        "**Rate limits.** Per key: 100 requests per minute and 1000 per hour by default. `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` are sent on responses to authenticated requests (not on a 401/403 returned before the key is known). Exceeding them returns `429 RATE_LIMITED` with `Retry-After`. Each key may also create at most 2000 new leads per day by default; beyond that, `429 LEAD_CAP_REACHED`.",
        "",
        "**Idempotency.** Send `Idempotency-Key` (1–255 printable ASCII characters) on every create. A retry with the same key and the same body within 24 hours returns `200` with the original result and `Idempotent-Replayed: true`. The same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`. While the first request is still being processed, a retry returns `409 IDEMPOTENCY_KEY_IN_PROGRESS` with `Retry-After`; a request abandoned for more than 2 minutes (crash or deploy) is taken over by the retry. Idempotency-Keys and external ids belong to the integration — a key and the keys it was rotated into — so a retry sent with the rotated key still replays.",
        "",
        "**Deduplication**, in order: (1) the Idempotency-Key; (2) the same `source` + `external_id` pushed by the same integration; (3) the same person — the same email, or the same phone number including its country code — on an open lead (not won, lost or deleted) created within the last 24 hours (the dedup window), whose event type and event date don't conflict (a blank on either side is not a conflict). Leads are never matched by name, and a deleted lead is never reused.",
        "",
        "**A match** returns `200` with the message `Lead already exists`, `duplicate: true`, `matched_by` (`idempotency_key`, `external_id` or `recent_contact`) and `updated_fields`. Without the `leads:update` scope the match is acknowledged and nothing on the lead changes (`updated_fields` is empty). With it, only blank fields are filled in — event type, event date, guest count, budget, venue, and the contact's missing email or phone; nothing already recorded is overwritten and the original creation time is kept. The message is appended to the lead as a note (an identical repeated message is not appended again), and `consent: true` is recorded against the contact if it wasn't already.",
        "",
        "**Attribution.** The first touch (the lead's attribution record and UTM fields) is never overwritten. Every push adds a touch record — the newest is the last touch — including ad set and ad ids, creative, keyword and `metadata`.",
        "",
        "**Leads.** `lead_id` is the CRM's internal id. A new lead's automatic WhatsApp welcome message is only sent when `consent` is `true`.",
        "",
        "**Tracing.** Every response, including `/api/v1/health`, `/api/v1/openapi.json` and `/api/v1/docs`, carries `X-Request-ID`. Quote it when reporting a problem.",
      ].join("\n"),
    },
    servers: [{ url: serverUrl }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/v1/push/leads": {
        post: {
          operationId: "pushLead",
          summary: "Create or update a lead",
          tags: ["Leads"],
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              description: "Unique id for this request. Strongly recommended.",
              schema: { type: "string", minLength: 1, maxLength: 255, example: "meta-lead-123456789" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LeadRequest" },
                example: {
                  external_id: "META-987654",
                  source: "meta_ads",
                  campaign: "Blossom Bellandur Wedding Campaign",
                  campaign_id: "123456789",
                  adset: "Wedding Leads",
                  ad_id: "987654321",
                  name: "Rahul Sharma",
                  phone: "+919876543210",
                  email: "rahul@example.com",
                  event_type: "wedding",
                  event_date: "2026-12-20",
                  guest_count: 250,
                  venue: "Blossom Bellandur",
                  budget: 250000,
                  message: "Looking for a wedding venue for 250 guests.",
                  utm_source: "facebook",
                  utm_medium: "paid_social",
                  utm_campaign: "blossom_wedding",
                  utm_content: "video_01",
                  landing_page: "https://veloriagrand.com/blossom-bellandur.html",
                  consent: true,
                  metadata: { fb_lead_id: "123456789", device: "mobile", landing_page_variant: "B" },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Lead created. The rate-limit headers are sent on every response to an authenticated request.",
              headers: {
                "X-Request-ID": { $ref: "#/components/headers/RequestId" },
                "X-RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
                "X-RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
                "X-RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
              },
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/LeadResponse" },
                  example: {
                    success: true,
                    message: "Lead created successfully",
                    request_id: "req_01J8ZQ4X7B5N2K9M3P6R8T0V1W",
                    data: { lead_id: "cmf2x9k0p0001abcd", external_id: "META-987654", status: "NEW", created: true, duplicate: false },
                  },
                },
              },
            },
            "200": {
              description:
                "Lead already exists (matched by Idempotency-Key, external id, or the same contact on a recent open lead). With leads:update, blank fields may have been filled in; an idempotent replay also carries Idempotent-Replayed: true.",
              headers: {
                "X-Request-ID": { $ref: "#/components/headers/RequestId" },
                "Idempotent-Replayed": {
                  description: "`true` when this is a replay of an earlier request with the same Idempotency-Key and body.",
                  schema: { type: "string", enum: ["true"] },
                },
                "X-RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
                "X-RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
                "X-RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
              },
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/LeadResponse" },
                  example: {
                    success: true,
                    message: "Lead already exists",
                    request_id: "req_01J8ZQ4X7B5N2K9M3P6R8T0V1X",
                    data: {
                      lead_id: "cmf2x9k0p0001abcd",
                      external_id: "META-987654",
                      status: "NEW",
                      created: false,
                      duplicate: true,
                      matched_by: "external_id",
                      updated_fields: [],
                    },
                  },
                },
              },
            },
            "400": multiErrorResponse("Body is not a JSON object, or the Idempotency-Key is malformed.", [
              { code: "INVALID_JSON", summary: "Body is not a JSON object", message: "Request body is not valid JSON." },
              {
                code: "INVALID_IDEMPOTENCY_KEY",
                summary: "Idempotency-Key malformed",
                message: "Idempotency-Key must be 1-255 printable ASCII characters.",
              },
            ]),
            "401": errorResponse("Missing or unknown API key.", "UNAUTHORIZED", "Invalid API key."),
            "403": multiErrorResponse("Request refused for this key or connection.", [
              { code: "HTTPS_REQUIRED", summary: "Sent over plain HTTP", message: "HTTPS is required." },
              { code: "API_KEY_REVOKED", summary: "Key revoked", message: "This API key has been revoked." },
              { code: "API_KEY_EXPIRED", summary: "Key expired", message: "This API key has expired." },
              { code: "INSUFFICIENT_SCOPE", summary: "Key not granted leads:create", message: "This API key is not allowed to use leads:create." },
              {
                code: "SOURCE_NOT_ALLOWED",
                summary: "Body source differs from the key's source",
                message: "This API key may only push leads with source meta_ads.",
              },
            ]),
            "409": multiErrorResponse(
              "Idempotency-Key conflict.",
              [
                {
                  code: "IDEMPOTENCY_KEY_REUSED",
                  summary: "Same key, different body",
                  message: "This Idempotency-Key was already used with a different request body.",
                },
                {
                  code: "IDEMPOTENCY_KEY_IN_PROGRESS",
                  summary: "First request still being processed (Retry-After sent)",
                  message: "A request with this Idempotency-Key is still in progress. Retry shortly.",
                },
              ],
              { "Retry-After": { $ref: "#/components/headers/RetryAfter" } }
            ),
            "413": errorResponse("Body larger than the limit (64 KB by default).", "PAYLOAD_TOO_LARGE", "Request body exceeds 65536 bytes."),
            "415": errorResponse("Content-Type is not application/json.", "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json."),
            "422": errorResponse("Validation failed (including metadata that is too large or too deeply nested). `error.fields` names each invalid field.", "VALIDATION_ERROR", "Invalid request", {
              fields: { phone: "Invalid phone number" },
            }),
            "429": multiErrorResponse(
              "Too many requests. Wait for Retry-After seconds.",
              [
                { code: "RATE_LIMITED", summary: "Per-key minute or hour limit", message: "Rate limit exceeded: 100 requests per minute." },
                {
                  code: "TOO_MANY_FAILED_ATTEMPTS",
                  summary: "Too many failed authentication attempts from this IP",
                  message: "Too many failed authentication attempts. Try again later.",
                },
                { code: "LEAD_CAP_REACHED", summary: "Daily new-lead cap for this key", message: "This API key has reached its daily limit of 2000 new leads." },
              ],
              {
                "Retry-After": { $ref: "#/components/headers/RetryAfter" },
                "X-RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" },
                "X-RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" },
                "X-RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" },
              }
            ),
            "500": errorResponse("Unexpected server error. No details are exposed; quote the request_id.", "INTERNAL_ERROR", "Something went wrong on our side. Quote the request_id if you contact us."),
            "503": errorResponse("The Push API is switched off.", "PUSH_API_DISABLED", "The Push API is currently disabled."),
          },
          "x-codeSamples": [
            {
              lang: "curl",
              label: "curl",
              source: [
                `curl -X POST "${serverUrl}/api/v1/push/leads" \\`,
                '  -H "Authorization: Bearer vg_live_xxxxxxxxx" \\',
                '  -H "Content-Type: application/json" \\',
                '  -H "Idempotency-Key: meta-lead-123456" \\',
                `  -d '${JSON.stringify(SAMPLE_BODY)}'`,
              ].join("\n"),
            },
            {
              lang: "JavaScript",
              label: "JavaScript (fetch)",
              source: [
                `const res = await fetch("${serverUrl}/api/v1/push/leads", {`,
                '  method: "POST",',
                "  headers: {",
                '    "Authorization": `Bearer ${process.env.VELORIA_API_KEY}`,',
                '    "Content-Type": "application/json",',
                '    "Idempotency-Key": "meta-lead-123456",',
                "  },",
                `  body: JSON.stringify(${JSON.stringify(SAMPLE_BODY)}),`,
                "});",
                "const json = await res.json();",
                "if (!res.ok) throw new Error(`${json.error.code}: ${json.error.message} (${json.request_id})`);",
                "console.log(json.data.lead_id, json.data.created, json.data.duplicate);",
              ].join("\n"),
            },
            {
              lang: "Python",
              label: "Python (requests)",
              source: [
                "import os, requests",
                "",
                "res = requests.post(",
                `    "${serverUrl}/api/v1/push/leads",`,
                "    headers={",
                "        \"Authorization\": f\"Bearer {os.environ['VELORIA_API_KEY']}\",",
                '        "Idempotency-Key": "meta-lead-123456",',
                "    },",
                `    json=${JSON.stringify(SAMPLE_BODY).replace(/true/g, "True")},`,
                "    timeout=30,",
                ")",
                "body = res.json()",
                "if not res.ok:",
                "    raise RuntimeError(f\"{body['error']['code']}: {body['error']['message']} ({body['request_id']})\")",
                'print(body["data"]["lead_id"], body["data"]["created"], body["data"]["duplicate"])',
              ].join("\n"),
            },
          ],
        },
      },
      "/api/v1/health": {
        get: {
          operationId: "health",
          summary: "Service health",
          tags: ["Health"],
          security: [],
          responses: {
            "200": {
              description: "The service is up.",
              headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
              content: {
                "application/json": { example: { status: "ok", service: "veloria-push-api", version: PUSH_API_VERSION } },
              },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "API key, e.g. vg_live_…" },
      },
      headers: {
        RequestId: { description: "Unique id for this request.", schema: { type: "string", example: "req_01J8ZQ4X7B5N2K9M3P6R8T0V1W" } },
        RateLimitLimit: { description: "Requests allowed in the current window.", schema: { type: "integer" } },
        RateLimitRemaining: { description: "Requests left in the current window.", schema: { type: "integer" } },
        RateLimitReset: { description: "Unix time (seconds) the window resets.", schema: { type: "integer" } },
        RetryAfter: { description: "Seconds to wait before retrying.", schema: { type: "integer" } },
      },
      schemas: {
        LeadRequest: {
          type: "object",
          required: ["source"],
          description: "`phone` or `email` is required. Unknown top-level fields are ignored; put extra data in `metadata`.",
          properties: LEAD_REQUEST_PROPERTIES,
          anyOf: [{ required: ["phone"] }, { required: ["email"] }],
        },
        LeadResponse: {
          type: "object",
          required: ["success", "message", "request_id", "data"],
          properties: {
            success: { type: "boolean", const: true },
            message: { type: "string", enum: ["Lead created successfully", "Lead already exists"] },
            request_id: { type: "string" },
            data: {
              type: "object",
              required: ["lead_id", "created", "duplicate"],
              properties: {
                lead_id: { type: "string", description: "The CRM's internal lead id." },
                external_id: { type: ["string", "null"] },
                status: { type: "string", description: "The CRM lead status, e.g. NEW, CONTACTED, QUALIFIED, WON, LOST." },
                created: { type: "boolean" },
                duplicate: { type: "boolean" },
                matched_by: {
                  type: ["string", "null"],
                  enum: ["idempotency_key", "external_id", "recent_contact", null],
                  description: "Why an existing lead was returned. Null when a lead was created.",
                },
                updated_fields: {
                  type: "array",
                  items: { type: "string" },
                  description: "Fields that were blank and have now been filled in. Always empty without the leads:update scope.",
                },
              },
            },
          },
        },
        Error: {
          type: "object",
          required: ["success", "error", "request_id"],
          properties: {
            success: { type: "boolean", const: false },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                fields: { type: "object", additionalProperties: { type: "string" } },
              },
            },
            request_id: { type: "string" },
          },
        },
      },
    },
  };
}
