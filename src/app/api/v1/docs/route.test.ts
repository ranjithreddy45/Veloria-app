import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { CALL_REQUEST_PROPERTIES, LEAD_REQUEST_PROPERTIES } from "@/lib/push-api/openapi";

describe("GET /api/v1/docs", () => {
  it("documents both push endpoints: fields, an example request and the expected responses", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();

    expect(html).toContain('id="leads"');
    for (const field of Object.keys(LEAD_REQUEST_PROPERTIES)) expect(html, field).toContain(`<code>${field}</code>`);

    const call = html.slice(html.indexOf('id="call-activity"'));
    expect(call).toContain("<h3>Fields</h3>");
    expect(call).toContain("<h3>Example request</h3>");
    expect(call).toContain("<h3>Expected responses</h3>");
    for (const field of Object.keys(CALL_REQUEST_PROPERTIES)) expect(call, field).toContain(`<code>${field}</code>`);
    expect(call).toContain("curl -X POST &quot;");
    expect(call).toContain("/api/v1/push/call-activity&quot;");
    for (const status of ["200", "201", "401", "403", "409", "422", "429"]) expect(call, status).toContain(`<td><code>${status}</code></td>`);
    expect(call).toContain("Lead created and call recorded");
    expect(call.indexOf("<td><code>201</code></td>")).toBeLessThan(call.indexOf("<td><code>200</code></td>"));
    expect(call).toContain("<code>ai_insights</code> that is too large");
    // Required markers come from the OpenAPI schema, not a hand-kept list.
    expect(call).toMatch(/<code>external_call_id<\/code><\/td><td>string<\/td><td>required<\/td>/);
    expect(call).toMatch(/<code>lead_id<\/code><\/td><td>string<\/td><td>lead_id or phone<\/td>/);
    // Allowed values and limits the validator enforces are shown, and no raw markdown backticks leak through.
    expect(call).toContain("Allowed: <code>positive</code>, <code>neutral</code>, <code>negative</code>.");
    expect(call).toContain("Range 0–100.");
    expect(call).not.toContain("`");
    // Still no scripts.
    expect(html).not.toMatch(/<script/i);
  });
});
