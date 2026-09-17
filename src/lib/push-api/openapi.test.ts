import { describe, expect, it } from "vitest";
import { buildOpenApiDocument, LEAD_REQUEST_PROPERTIES } from "./openapi";
import { PUSH_LEAD_FIELDS } from "./leads/schema";
import { PUSH_API_ERRORS } from "./errors";

describe("OpenAPI document", () => {
  const doc = buildOpenApiDocument("https://app.theveloriagrand.com");

  it("documents exactly the fields the validator accepts", () => {
    expect(Object.keys(LEAD_REQUEST_PROPERTIES).sort()).toEqual([...PUSH_LEAD_FIELDS].sort());
  });

  it("documents a response for every status the API can return", () => {
    const documented = new Set(Object.keys(doc.paths["/api/v1/push/leads"].post.responses));
    const returned = new Set([201, 200, ...Object.values(PUSH_API_ERRORS)].map(String));
    for (const status of returned) {
      // 405 is produced by the framework for other methods, not by this operation.
      if (status === "405") continue;
      expect(documented, `status ${status}`).toContain(status);
    }
  });

  it("is OpenAPI 3.1 with bearer auth", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
    expect(doc.servers[0]!.url).toBe("https://app.theveloriagrand.com");
  });
});
