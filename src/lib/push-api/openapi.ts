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
    "Phone number. Indian mobiles are accepted in any common format (9876543210, 919876543210, +91 98765 43210) and stored as +919876543210. Other countries need the +country code.",
    { example: "+919876543210" }
  ),
  email: str("Email address. Stored lowercase.", { format: "email", maxLength: 254, example: "rahul@example.com" }),
  event_type: str("Kind of event.", { maxLength: 100, example: "wedding" }),
  event_date: str("Event date.", { format: "date", example: "2026-12-20" }),
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
  fbclid: str("Meta click id.", { maxLength: 300 }),
  consent: { type: "boolean", description: "Whether the enquirer consented to be contacted. `true` is recorded against the contact." },
  metadata: {
    type: "object",
    additionalProperties: true,
    description: "Any extra parameters. Stored as JSON on the lead's touch record. At most 50 keys, 3 levels deep, 8 KB.",
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

export function buildOpenApiDocument(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Veloria Grand Push API",
      version: PUSH_API_VERSION,
      description: [
        "Push leads from authorised external systems (ad platforms, the website, partners) into the Veloria Grand CRM.",
        "",
        "**Authentication.** `Authorization: Bearer <API_KEY>`. Keys are issued in Settings → Integrations → Lead Capture, shown once, and must be granted the `leads:create` scope. 401 = key unknown; 403 = key revoked, expired or missing the scope.",
        "",
        "**Idempotency.** Send `Idempotency-Key` (1–255 printable ASCII characters) on every create. A retry with the same key and body returns `200` with the original lead and `Idempotent-Replayed: true`; the same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`. Keys are remembered for 24 hours by default.",
        "",
        "**Deduplication.** Without an Idempotency-Key, a lead is still matched to an existing one by `source` + `external_id`, and then by the same phone or email on an open lead created within the last 24 hours. A match returns `200` with `duplicate: true`; missing details (event date, guests, budget, venue) are filled in, but nothing already on the lead is overwritten. Leads are never matched on name alone.",
        "",
        "**Rate limits.** 100 requests per minute and 1000 per hour per key by default. Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`; a `429` also carries `Retry-After`.",
        "",
        "**Tracing.** Every response carries `X-Request-ID`. Quote it when reporting a problem.",
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
              description: "Lead created.",
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
              description: "Lead already exists (matched by Idempotency-Key, external id, or the same contact). Blank fields may have been filled in.",
              headers: { "X-Request-ID": { $ref: "#/components/headers/RequestId" } },
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
            "400": errorResponse("Body is not a JSON object, or the Idempotency-Key is malformed.", "INVALID_JSON", "Request body is not valid JSON."),
            "401": errorResponse("Missing or unknown API key.", "UNAUTHORIZED", "Invalid API key."),
            "403": errorResponse("API key revoked, expired, or not granted leads:create.", "API_KEY_REVOKED", "This API key has been revoked."),
            "409": errorResponse(
              "Idempotency-Key reused with a different body, or its first request is still in progress.",
              "IDEMPOTENCY_KEY_REUSED",
              "This Idempotency-Key was already used with a different request body."
            ),
            "413": errorResponse("Body larger than the limit (64 KB by default).", "PAYLOAD_TOO_LARGE", "Request body exceeds 65536 bytes."),
            "415": errorResponse("Content-Type is not application/json.", "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json."),
            "422": errorResponse("Validation failed. `error.fields` names each invalid field.", "VALIDATION_ERROR", "Invalid request", {
              fields: { phone: "Invalid phone number" },
            }),
            "429": errorResponse("Rate limit exceeded. Wait for Retry-After seconds.", "RATE_LIMITED", "Rate limit exceeded: 100 requests per minute."),
            "500": errorResponse("Unexpected server error. No details are exposed; quote the request_id.", "INTERNAL_ERROR", "Something went wrong on our side. Quote the request_id if you contact us."),
            "503": errorResponse("The Push API is switched off.", "PUSH_API_DISABLED", "The Push API is currently disabled."),
          },
          "x-codeSamples": [
            {
              lang: "curl",
              source: [
                `curl -X POST "${serverUrl}/api/v1/push/leads" \\`,
                '  -H "Authorization: Bearer vg_live_xxxxxxxxx" \\',
                '  -H "Content-Type: application/json" \\',
                '  -H "Idempotency-Key: meta-lead-123456" \\',
                `  -d '{"external_id":"META-123456","source":"meta_ads","name":"Rahul Sharma","phone":"+919876543210","email":"rahul@example.com","guest_count":250,"event_type":"wedding"}'`,
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
            message: { type: "string" },
            request_id: { type: "string" },
            data: {
              type: "object",
              required: ["lead_id", "created", "duplicate"],
              properties: {
                lead_id: { type: "string" },
                external_id: { type: ["string", "null"] },
                status: { type: "string", description: "The CRM lead status, e.g. NEW, CONTACTED, QUALIFIED, WON, LOST." },
                created: { type: "boolean" },
                duplicate: { type: "boolean" },
                matched_by: {
                  type: ["string", "null"],
                  enum: ["idempotency_key", "external_id", "recent_contact", "contact_open_lead", null],
                },
                updated_fields: { type: "array", items: { type: "string" } },
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
