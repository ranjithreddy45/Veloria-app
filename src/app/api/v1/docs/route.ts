import { buildOpenApiDocument, LEAD_REQUEST_PROPERTIES } from "@/lib/push-api/openapi";

// GET /api/v1/docs — human-readable Push API reference, rendered from the same
// OpenAPI object as /api/v1/openapi.json. No scripts, no external assets.
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

  const fieldRows = Object.entries(LEAD_REQUEST_PROPERTIES)
    .map(([name, schema]) => {
      const type = Array.isArray(schema.type) ? schema.type.join(" | ") : String(schema.type);
      const required = name === "source" ? "required" : name === "phone" || name === "email" ? "phone or email" : "";
      return `<tr><td><code>${esc(name)}</code></td><td>${esc(type)}</td><td>${esc(required)}</td><td>${esc(schema.description)}</td></tr>`;
    })
    .join("");

  const responseRows = Object.entries(op.responses)
    .map(([status, r]) => `<tr><td><code>${esc(status)}</code></td><td>${esc((r as { description: string }).description)}</td></tr>`)
    .join("");

  const compact = JSON.stringify({
    external_id: "META-123456",
    source: "meta_ads",
    name: "Rahul Sharma",
    phone: "+919876543210",
    email: "rahul@example.com",
    guest_count: 250,
    event_type: "wedding",
  });

  const curl = op["x-codeSamples"][0]!.source;
  const js = `const res = await fetch("${url}/api/v1/push/leads", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.VELORIA_API_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": "meta-lead-123456",
  },
  body: JSON.stringify(${compact}),
});
const json = await res.json();
if (!res.ok) throw new Error(\`\${json.error.code}: \${json.error.message} (\${json.request_id})\`);
console.log(json.data.lead_id, json.data.created);`;
  const py = `import os, requests

res = requests.post(
    "${url}/api/v1/push/leads",
    headers={
        "Authorization": f"Bearer {os.environ['VELORIA_API_KEY']}",
        "Idempotency-Key": "meta-lead-123456",
    },
    json=${compact},
    timeout=30,
)
body = res.json()
if not res.ok:
    raise RuntimeError(f"{body['error']['code']}: {body['error']['message']} ({body['request_id']})")
print(body["data"]["lead_id"], body["data"]["created"])`;

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
</style></head><body><main>
<h1>Veloria Grand Push API</h1>
<p class="meta">Version ${esc(doc.info.version)} · <a href="/api/v1/openapi.json">OpenAPI 3.1 JSON</a> · <a href="/api/v1/health">Health</a></p>
${description}
<h2><span class="method">POST</span><code>/api/v1/push/leads</code></h2>
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
<div class="wrap"><table><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody>${responseRows}</tbody></table></div>
<h3>201 Created</h3><pre><code>${esc(JSON.stringify(op.responses["201"].content["application/json"].example, null, 2))}</code></pre>
<h3>200 Already exists</h3><pre><code>${esc(JSON.stringify(op.responses["200"].content["application/json"].example, null, 2))}</code></pre>
<h3>422 Validation error</h3><pre><code>${esc(JSON.stringify(op.responses["422"].content["application/json"].example, null, 2))}</code></pre>
<h2>Examples</h2>
<h3>curl</h3><pre><code>${esc(curl)}</code></pre>
<h3>JavaScript (fetch)</h3><pre><code>${esc(js)}</code></pre>
<h3>Python (requests)</h3><pre><code>${esc(py)}</code></pre>
<h2><span class="method">GET</span><code>/api/v1/health</code></h2>
<pre><code>${esc(JSON.stringify({ status: "ok", service: "veloria-push-api", version: doc.info.version }, null, 2))}</code></pre>
</main></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}
