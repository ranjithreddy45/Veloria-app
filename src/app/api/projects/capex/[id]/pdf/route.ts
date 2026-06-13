import { prisma } from "@/lib/prisma";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { computeCapex, type CapexInput, type CapexResult } from "@/lib/projects/capex-calc";

export const runtime = "nodejs";

// Branded CapEx projection — shared with the venue owner (no login) once the
// Projects Head has APPROVED it. Rendered from the frozen snapshot.
// Access requires EITHER an authenticated internal session (projects:read/approve)
// OR the opaque ?token= that matches the projection's shareToken — so the raw id
// alone is not enough to read a venue's internal financials.
const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("token");
  const c = await prisma.acqCapexProjection.findUnique({
    where: { id },
    include: { project: { include: { property: { select: { propertyName: true, ownerName: true, city: true, locality: true } } } } },
  });
  if (!c) return new Response("Not available.", { status: 404 });
  if (c.status !== "APPROVED" && c.status !== "SENT") return new Response("This projection is not finalized.", { status: 403 });

  // Authorize: internal staff via session, or the owner via the share token.
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const internalOk = !!session?.user && (role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role ?? "", "projects:read") || hasPermission(role ?? "", "projects:approve"));
  const tokenOk = !!token && !!c.shareToken && token === c.shareToken;
  if (!internalOk && !tokenOk) return new Response("Unauthorized.", { status: 401 });

  const result: CapexResult = (c.outputsJson as unknown as CapexResult) || computeCapex(c.inputsJson as unknown as CapexInput);
  const prop = c.project.property;
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  const rows = result.lines
    .map((l) => `<tr><td>${esc(l.label)}</td><td class="r">${l.basis === "LUMPSUM" ? "—" : inr(l.rate)}</td><td class="r">${l.basis === "LUMPSUM" ? "—" : l.qty.toLocaleString("en-IN")}</td><td class="r">${inr(l.amount)}</td></tr>`)
    .join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>CapEx Projection — ${esc(prop.propertyName)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:${PLUM}; background:${IVORY}; margin:0; padding:24px; }
  .doc { max-width: 820px; margin:0 auto; }
  .header { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid ${GOLD}; padding-bottom:14px; }
  .brand { font-size:22px; font-weight:800; } .brand small { display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:${GOLD}; }
  .title { text-align:right; font-weight:700; } .title small { display:block; font-weight:500; color:#6b5b73; }
  .details { display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; margin:16px 0; font-size:12.5px; }
  .d { display:flex; justify-content:space-between; border-bottom:1px dashed #e6dccb; padding:4px 0; } .d span { color:#6b5b73; }
  h2 { font-size:13px; margin:18px 0 8px; padding:6px 10px; background:${PLUM}; color:${IVORY}; border-radius:6px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; border-radius:8px; overflow:hidden; }
  th,td { padding:8px 10px; text-align:left; border-bottom:1px solid #efe7dd; } th { background:${PLUM}; color:${IVORY}; font-size:11px; }
  td.r,th.r { text-align:right; white-space:nowrap; }
  .totals td { border:0; padding:4px 10px; } .totals tr.grand td { background:#f6efe2; font-weight:800; font-size:14px; padding:9px 10px; }
  .actions { text-align:center; margin:8px 0 18px; } .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  .footer { margin-top:22px; padding-top:12px; border-top:1px solid #e6dccb; font-size:10.5px; color:#6b5b73; }
  @media print { .actions { display:none } body { padding:0 } }
</style></head><body><div class="doc">
  <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
  <div class="header"><div class="brand">Veloria Grand<small>Premium Event Venues</small></div>
    <div class="title">Capital Expenditure Projection<small>${esc(prop.propertyName)} · v${c.version}</small></div></div>
  <div class="details">
    <div class="d"><span>Owner</span><strong>${esc(prop.ownerName)}</strong></div>
    <div class="d"><span>Date</span><strong>${today}</strong></div>
    <div class="d"><span>Property</span><strong>${esc(prop.propertyName)}</strong></div>
    <div class="d"><span>Location</span><strong>${esc(prop.locality)}, ${esc(prop.city)}</strong></div>
    <div class="d"><span>Estimated timeline</span><strong>${result.estimatedWeeks} weeks</strong></div>
    <div class="d"><span>Built-up area</span><strong>${Number((c.inputsJson as { builtUpAreaSqft?: number }).builtUpAreaSqft ?? 0).toLocaleString("en-IN")} sq ft</strong></div>
  </div>
  <h2>Estimated Capital Works</h2>
  <table><thead><tr><th>Scope</th><th class="r">Rate</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <table class="totals"><tbody>
    <tr><td colspan="3" class="r">Subtotal</td><td class="r">${inr(result.subtotal)}</td></tr>
    <tr><td colspan="3" class="r">Contingency (${result.contingencyPct}%)</td><td class="r">${inr(result.contingencyAmount)}</td></tr>
    <tr class="grand"><td colspan="3" class="r">Total Estimated CapEx</td><td class="r">${inr(result.total)}</td></tr>
  </tbody></table>
  ${c.notes ? `<h2>Notes</h2><p style="font-size:12px">${esc(c.notes)}</p>` : ""}
  <div class="footer">Indicative estimate prepared by the Veloria Grand Projects team to bring ${esc(prop.propertyName)} to luxury, fully-bookable standard. Actuals vary with final scope, site conditions and material selections.</div>
</div></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
