import { buildOpenApiDocument, CALL_REQUEST_PROPERTIES, LEAD_REQUEST_PROPERTIES } from "@/lib/push-api/openapi";
import { newRequestId } from "@/lib/push-api/request-id";

// GET /api/v1/docs — human-readable Push API reference (lead push and call
// activity), rendered from the same OpenAPI object as /api/v1/openapi.json.
// No scripts, no external assets.
export const dynamic = "force-dynamic";

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com").replace(/\/+$/, "");
}

export function GET() {
  const url = baseUrl();
  const doc = buildOpenApiDocument(url);
  const op = doc.paths["/api/v1/push/leads"].post;
  const example = op.requestBody.content["application/json"].example;

  /** Escaped text with `code` spans rendered as <code>. */
  const inline = (text: unknown) => esc(text).replace(/`([^`]+)`/g, "<code>$1</code>");

  /** The description plus the limits the validator enforces (allowed values, ranges, lengths), from the schema. */
  const describeField = (schema: Record<string, unknown>) => {
    const rules: string[] = [];
    const items = schema.items as Record<string, unknown> | undefined;
    if (Array.isArray(schema.enum)) rules.push(`Allowed: ${schema.enum.map((v) => `<code>${esc(v)}</code>`).join(", ")}.`);
    if (typeof schema.minimum === "number" && typeof schema.maximum === "number") rules.push(`Range ${schema.minimum}–${schema.maximum}.`);
    if (typeof schema.maxLength === "number") rules.push(`Max ${schema.maxLength} characters.`);
    if (typeof schema.maxItems === "number") {
      rules.push(`Max ${schema.maxItems} items${typeof items?.maxLength === "number" ? `, ${items.maxLength} characters each` : ""}.`);
    }
    const example = schema.example;
    const shown = example !== undefined && (typeof example !== "object" || example === null) ? ` Example: <code>${esc(example)}</code>.` : "";
    return `${inline(schema.description)}${rules.length ? ` <span class="rules">${rules.join(" ")}</span>` : ""}${shown}`;
  };

  const fieldRowsFor = (properties: Record<string, Record<string, unknown>>, required: (name: string) => string) =>
    Object.entries(properties)
      .map(([name, schema]) => {
        const base = Array.isArray(schema.type) ? schema.type.join(" | ") : String(schema.type);
        const items = schema.items as { type?: string } | undefined;
        const type = base === "array" && items?.type ? `array of ${items.type}s` : base;
        return `<tr><td><code>${esc(name)}</code></td><td>${esc(type)}</td><td>${esc(required(name))}</td><td>${describeField(schema)}</td></tr>`;
      })
      .join("");
  const fieldRows = fieldRowsFor(LEAD_REQUEST_PROPERTIES, (name) =>
    name === "source" ? "required" : name === "phone" || name === "email" ? "phone or email" : ""
  );

  // Error codes a status can carry, read from its `example` or `examples` map.
  const codesFor = (r: unknown): string[] => {
    const media = (r as { content?: Record<string, { example?: unknown; examples?: Record<string, { value?: unknown }> }> })
      .content?.["application/json"];
    const values = media?.examples ? Object.values(media.examples).map((e) => e.value) : media?.example ? [media.example] : [];
    return values
      .map((v) => (v as { error?: { code?: string } } | undefined)?.error?.code)
      .filter((c): c is string => typeof c === "string");
  };

  // Success first (201, then 200), then errors in order. Numeric keys otherwise enumerate ascending.
  const statusOrder = (status: string) => (status === "201" ? 0 : status === "200" ? 1 : Number(status));
  const responseRowsFor = (responses: Record<string, unknown>) =>
    Object.entries(responses)
      .sort(([a], [b]) => statusOrder(a) - statusOrder(b))
      .map(
        ([status, r]) =>
          `<tr><td><code>${esc(status)}</code></td><td>${codesFor(r).map((c) => `<code>${esc(c)}</code>`).join(" ")}</td><td>${inline((r as { description: string }).description)}</td></tr>`
      )
      .join("");
  const responseRows = responseRowsFor(op.responses);
  const exampleOf = (r: unknown) =>
    esc(JSON.stringify((r as { content: Record<string, { example: unknown }> }).content["application/json"].example, null, 2));

  // POST /api/v1/push/call-activity — CallVibe's call results, from the same OpenAPI object.
  const callOp = doc.paths["/api/v1/push/call-activity"].post;
  const callRequired = new Set<string>(doc.components.schemas.CallActivityRequest.required);
  const callFieldRows = fieldRowsFor(CALL_REQUEST_PROPERTIES, (name) =>
    callRequired.has(name) ? "required" : name === "lead_id" || name === "phone" ? "lead_id or phone" : ""
  );
  const callExample = callOp.requestBody.content["application/json"].example;
  const callCurl = [
    `curl -X POST "${url}/api/v1/push/call-activity" \\`,
    '  -H "Authorization: Bearer vg_live_xxxxxxxxx" \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "Idempotency-Key: cv-call-9f31ab2e" \\',
    `  -d '${JSON.stringify(callExample, null, 2).replace(/\n/g, "\n  ")}'`,
  ].join("\n");
  const callResponseRows = responseRowsFor(callOp.responses);

  const samples = op["x-codeSamples"]
    .map((sample) => `<h3>${esc(sample.label)}</h3><pre><code>${esc(sample.source)}</code></pre>`)
    .join("\n");

  const description = doc.info.description
    .split("\n\n")
    .map((p) => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`)
    .join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Veloria Grand Push API</title>
<style>
:root{color-scheme:light dark;--ink:#1d1d1f;--muted:#5b5b60;--line:#e3e1dc;--bg:#fbfaf8;--code:#f1efea;--accent:#006742}
@media (prefers-color-scheme:dark){:root{--ink:#ecebe8;--muted:#a9a8a4;--line:#34332f;--bg:#171715;--code:#232320;--accent:#5fcf9b}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:980px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:28px;margin:0 0 4px;letter-spacing:-.01em}h2{font-size:19px;margin:40px 0 10px;padding-top:16px;border-top:1px solid var(--line)}
.meta{color:var(--muted);margin:0 0 24px}code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--code);padding:1px 5px;border-radius:4px}
pre{background:var(--code);padding:14px 16px;border-radius:8px;overflow-x:auto}pre code{background:none;padding:0}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em}.wrap{overflow-x:auto}
.method{display:inline-block;background:var(--accent);color:#fff;font-weight:700;font-size:12px;padding:2px 8px;border-radius:4px;margin-right:6px}
a{color:var(--accent)}
.rules{color:var(--muted)}
</style></head><body><main>
<h1>Veloria Grand Push API</h1>
<p class="meta">Version ${esc(doc.info.version)} · <a href="/api/v1/openapi.json">OpenAPI 3.1 JSON</a> · <a href="/api/v1/health">Health</a></p>
<p class="meta">Endpoints: <a href="#leads"><code>POST /api/v1/push/leads</code></a> · <a href="#call-activity"><code>POST /api/v1/push/call-activity</code></a> · <a href="#health"><code>GET /api/v1/health</code></a></p>
${description}
<h2 id="leads"><span class="method">POST</span><code>/api/v1/push/leads</code></h2>
<h3>Headers</h3>
<div class="wrap"><table><thead><tr><th>Header</th><th>Required</th><th>Value</th></tr></thead><tbody>
<tr><td><code>Authorization</code></td><td>yes</td><td><code>Bearer vg_live_…</code></td></tr>
<tr><td><code>Content-Type</code></td><td>yes</td><td><code>application/json</code></td></tr>
<tr><td><code>Idempotency-Key</code></td><td>recommended</td><td>1–255 printable ASCII characters, unique per lead</td></tr>
</tbody></table></div>
<h3>Body fields</h3>
<div class="wrap"><table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>${fieldRows}</tbody></table></div>
<h3>Example body</h3><pre><code>${esc(JSON.stringify(example, null, 2))}</code></pre>
<h3>Responses</h3>
<div class="wrap"><table><thead><tr><th>Status</th><th>Error codes</th><th>Meaning</th></tr></thead><tbody>${responseRows}</tbody></table></div>
<h3>201 Created</h3><pre><code>${esc(JSON.stringify(op.responses["201"].content["application/json"].example, null, 2))}</code></pre>
<h3>200 Already exists</h3><pre><code>${esc(JSON.stringify(op.responses["200"].content["application/json"].example, null, 2))}</code></pre>
<h3>422 Validation error</h3><pre><code>${esc(JSON.stringify(op.responses["422"].content["application/json"].example, null, 2))}</code></pre>
<h2>Examples</h2>
${samples}
<h2 id="call-activity"><span class="method">POST</span><code>/api/v1/push/call-activity</code></h2>
<p>${inline(callOp.description)}</p>
<h3>Headers</h3>
<div class="wrap"><table><thead><tr><th>Header</th><th>Required</th><th>Value</th></tr></thead><tbody>
<tr><td><code>Authorization</code></td><td>yes</td><td><code>Bearer vg_live_…</code> (a key granted <code>calls:create</code>)</td></tr>
<tr><td><code>Content-Type</code></td><td>yes</td><td><code>application/json</code></td></tr>
<tr><td><code>Idempotency-Key</code></td><td>recommended</td><td>1–255 printable ASCII characters, unique per call</td></tr>
</tbody></table></div>
<h3>Fields</h3>
<div class="wrap"><table><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>${callFieldRows}</tbody></table></div>
<p>Unknown top-level fields are ignored. Each invalid field is named in <code>error.fields</code> of a 422 response.</p>
<h3>Example request</h3>
<pre><code>${esc(callCurl)}</code></pre>
<h3>Expected responses</h3>
<div class="wrap"><table><thead><tr><th>Status</th><th>Error codes</th><th>Meaning</th></tr></thead><tbody>${callResponseRows}</tbody></table></div>
<h3>201 Created — lead created, call recorded</h3><pre><code>${exampleOf(callOp.responses["201"])}</code></pre>
<h3>200 OK — call recorded on an existing lead</h3><pre><code>${exampleOf(callOp.responses["200"])}</code></pre>
<h3>422 Validation error</h3><pre><code>${exampleOf(callOp.responses["422"])}</code></pre>
<h2 id="health"><span class="method">GET</span><code>/api/v1/health</code></h2>
<pre><code>${esc(JSON.stringify({ status: "ok", service: "veloria-push-api", version: doc.info.version }, null, 2))}</code></pre>
</main></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      "X-Request-ID": newRequestId(),
    },
  });
}
