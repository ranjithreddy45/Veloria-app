import { prisma } from "@/lib/prisma";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

// Internal venue HANDOVER report — submitted by the Projects Head to Operations
// and Management. Auth-gated to internal staff with projects access.
const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const ok = !!session?.user && (role === "SUPER_ADMIN" || role === "ADMIN" || hasPermission(role ?? "", "projects:read") || hasPermission(role ?? "", "projects:audit"));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  const p = await prisma.acqOnboardingProject.findUnique({
    where: { id },
    include: {
      property: true,
      projectManager: { select: { name: true } },
      opsAuditBy: { select: { name: true } },
      handoverBy: { select: { name: true } },
      readinessItems: { select: { category: true, status: true } },
      opsAuditItems: { select: { status: true, critical: true } },
    },
  });
  if (!p) return new Response("Not found", { status: 404 });
  if (!p.handoverReportAt) return new Response("Handover not submitted yet.", { status: 403 });

  const rTotal = p.readinessItems.length;
  const rDone = p.readinessItems.filter((r) => r.status === "DONE" || r.status === "NA").length;
  const rPct = rTotal ? Math.round((rDone / rTotal) * 100) : 0;
  // readiness per category
  const cats = new Map<string, { total: number; done: number }>();
  for (const r of p.readinessItems) {
    const c = cats.get(r.category) ?? { total: 0, done: 0 };
    c.total++;
    if (r.status === "DONE" || r.status === "NA") c.done++;
    cats.set(r.category, c);
  }
  const aPass = p.opsAuditItems.filter((a) => a.status === "PASS" || a.status === "NA").length;
  const aTotal = p.opsAuditItems.length;
  const today = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "—");

  const catRows = Array.from(cats.entries())
    .map(([cat, c]) => `<tr><td>${esc(cat)}</td><td class="r">${c.done}/${c.total}</td><td class="r">${Math.round((c.done / c.total) * 100)}%</td></tr>`)
    .join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Venue Handover — ${esc(p.property.propertyName)}</title>
<style>
  @page { size:A4 portrait; margin:14mm }
  body { font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:${PLUM}; background:${IVORY}; margin:0; padding:24px }
  .doc { max-width:820px; margin:0 auto }
  .header { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid ${GOLD}; padding-bottom:14px }
  .brand { font-size:22px; font-weight:800 } .brand small { display:block; font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:${GOLD} }
  .title { text-align:right; font-weight:700 } .title small { display:block; font-weight:500; color:#6b5b73 }
  .details { display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; margin:16px 0; font-size:12.5px }
  .d { display:flex; justify-content:space-between; border-bottom:1px dashed #e6dccb; padding:4px 0 } .d span { color:#6b5b73 }
  h2 { font-size:13px; margin:18px 0 8px; padding:6px 10px; background:${PLUM}; color:${IVORY}; border-radius:6px }
  table { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; border-radius:8px; overflow:hidden }
  th,td { padding:8px 10px; text-align:left; border-bottom:1px solid #efe7dd } th { background:${PLUM}; color:${IVORY}; font-size:11px }
  td.r,th.r { text-align:right }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-weight:700; font-size:12px }
  .ok { background:#dff5e8; color:#1b7a45 }
  .actions { text-align:center; margin:8px 0 18px } .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer }
  @media print { .actions { display:none } body { padding:0 } }
</style></head><body><div class="doc">
  <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
  <div class="header"><div class="brand">Veloria Grand<small>Premium Event Venues</small></div>
    <div class="title">Venue Handover Report<small>${esc(p.property.propertyName)}</small></div></div>
  <div class="details">
    <div class="d"><span>Property</span><strong>${esc(p.property.propertyName)}</strong></div>
    <div class="d"><span>Location</span><strong>${esc(p.property.locality)}, ${esc(p.property.city)}</strong></div>
    <div class="d"><span>Project Manager</span><strong>${esc(p.projectManager?.name ?? "—")}</strong></div>
    <div class="d"><span>Handover by</span><strong>${esc(p.handoverBy?.name ?? "—")}</strong></div>
    <div class="d"><span>Ops audit by</span><strong>${esc(p.opsAuditBy?.name ?? "—")}</strong></div>
    <div class="d"><span>Handover date</span><strong>${today(p.handoverReportAt)}</strong></div>
  </div>

  <h2>Certification</h2>
  <p style="font-size:12.5px">This venue has been readied to Veloria Grand standards. Overall readiness <strong>${rPct}%</strong>; operations deep-audit <span class="pill ok">${aPass}/${aTotal} cleared${p.opsAuditPassedAt ? " · PASSED" : ""}</span>. The property is handed over in operational condition for launch.</p>

  <h2>Readiness Summary</h2>
  <table><thead><tr><th>Category</th><th class="r">Cleared</th><th class="r">%</th></tr></thead><tbody>${catRows}</tbody></table>

  <h2>Audit & Sign-off</h2>
  <div class="details">
    <div class="d"><span>Ops audit passed</span><strong>${today(p.opsAuditPassedAt)}</strong></div>
    <div class="d"><span>Target ready date</span><strong>${today(p.targetReadyDate)}</strong></div>
  </div>
  ${p.notes ? `<h2>Remarks</h2><p style="font-size:12.5px">${esc(p.notes)}</p>` : ""}
  <p style="margin-top:22px;font-size:10.5px;color:#6b5b73;border-top:1px solid #e6dccb;padding-top:12px">Generated ${today(new Date())} · Veloria Grand Projects → Operations & Management handover.</p>
</div></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
