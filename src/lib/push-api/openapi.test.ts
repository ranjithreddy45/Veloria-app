import { describe, expect, it } from "vitest";
import { buildOpenApiDocument, CALL_REQUEST_PROPERTIES, LEAD_REQUEST_PROPERTIES } from "./openapi";
import { PUSH_CALL_FIELDS } from "./calls/schema";
import { PUSH_LEAD_FIELDS } from "./leads/schema";
import { PUSH_API_ERRORS } from "./errors";

describe("OpenAPI document", () => {
  const doc = buildOpenApiDocument("https://app.theveloriagrand.com");

  it("documents exactly the fields the validator accepts", () => {
    expect(Object.keys(LEAD_REQUEST_PROPERTIES).sort()).toEqual([...PUSH_LEAD_FIELDS].sort());
  });

  it("documents exactly the call-activity fields the validator accepts", () => {
    expect(Object.keys(CALL_REQUEST_PROPERTIES).sort()).toEqual([...PUSH_CALL_FIELDS].sort());
  });

  it("documents every error code for call activity too", () => {
    const responses = doc.paths["/api/v1/push/call-activity"].post.responses as Record<string, unknown>;
    expect(Object.keys(responses)).toEqual(expect.arrayContaining(["200", "201"]));
    for (const [code, status] of Object.entries(PUSH_API_ERRORS)) {
      if (status === 405) continue;
      expect(JSON.stringify(responses[String(status)] ?? null), `${code} under ${status}`).toContain(`"code":"${code}"`);
    }
    expect(JSON.stringify(responses["403"])).toContain("calls:create");
  });

  it("documents a response for every status the API can return", () => {
    const documented = new Set(Object.keys(doc.paths["/api/v1/push/leads"].post.responses));
    const returned = new Set<string>([201, 200, ...Object.values(PUSH_API_ERRORS)].map(String));
    for (const status of returned) {
      // 405 is produced by the framework for other methods, not by this operation.
      if (status === "405") continue;
      expect(documented, `status ${status}`).toContain(status);
    }
  });

  it("documents every error code under its own status", () => {
    const responses = doc.paths["/api/v1/push/leads"].post.responses as Record<string, unknown>;
    for (const [code, status] of Object.entries(PUSH_API_ERRORS)) {
      if (status === 405) continue;
      const body = JSON.stringify(responses[String(status)] ?? null);
      expect(body, `${code} under ${status}`).toContain(`"code":"${code}"`);
    }
  });

  it("documents matched_by values the API returns", () => {
    const matchedBy = doc.components.schemas.LeadResponse.properties.data.properties.matched_by;
    expect(matchedBy.enum).toEqual(["idempotency_key", "external_id", "recent_contact", null]);
  });

  it("ships curl, JavaScript and Python code samples", () => {
    const langs = doc.paths["/api/v1/push/leads"].post["x-codeSamples"].map((s) => s.lang);
    expect(langs).toEqual(expect.arrayContaining(["curl", "JavaScript", "Python"]));
  });

  it("is OpenAPI 3.1 with bearer auth", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
    expect(doc.servers[0]!.url).toBe("https://app.theveloriagrand.com");
  });
});
