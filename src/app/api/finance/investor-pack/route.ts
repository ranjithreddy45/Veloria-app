import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import {
  getProfitAndLoss,
  getBalanceSheet,
  getTrialBalance,
  getFinFiscalYears,
} from "@/actions/finance.actions";

export const runtime = "nodejs";

// Branded Board & Investor Pack — a print-to-PDF financial summary for the
// venue owner / board. Requires an authenticated internal session with
// finance:read. Pulls live figures from the posted ledger via finance.actions.
const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || !hasPermission(role ?? "", "finance:read")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const fiscalYears = await getFinFiscalYears();
  const fyParam = new URL(req.url).searchParams.get("fy");
  const fy = fyParam && fiscalYears.includes(fyParam) ? fyParam : (fiscalYears[0] ?? "");

  const [pl, bs, tb] = await Promise.all([
    getProfitAndLoss(fy || undefined),
    getBalanceSheet(),
    getTrialBalance(),
  ]);

  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  const margin = pl.totalIncome > 0 ? Math.round((pl.netProfit / pl.totalIncome) * 100) : 0;
  const fyLabel = fy ? esc(fy) : "All periods";

  const tile = (label: string, value: string, accent = false) =>
    `<div class="tile${accent ? " accent" : ""}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc("Veloria Grand — Board & Investor Pack")}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  body { font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:${PLUM}; background:${IVORY}; margin:0; padding:24px; }
  .doc { max-width: 820px; margin:0 auto; }
  .actions { text-align:center; margin:8px 0 18px; } .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  .cover { background:${PLUM}; color:${IVORY}; border-radius:14px; padding:40px 34px; border:1px solid ${GOLD}; }
  .cover .kicker { font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:${GOLD}; }
  .cover h1 { font-size:30px; margin:10px 0 6px; font-weight:800; }
  .cover .sub { font-size:13px; color:#d8cfe0; }
  .cover .meta { display:grid; grid-template-columns:1fr 1fr; gap:6px 24px; margin-top:24px; font-size:12.5px; }
  .cover .meta .m { display:flex; justify-content:space-between; border-bottom:1px solid rgba(201,169,110,.35); padding:5px 0; } .cover .meta .m span { color:${GOLD}; }
  h2 { font-size:13px; margin:24px 0 8px; padding:6px 10px; background:${PLUM}; color:${IVORY}; border-radius:6px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; border-radius:8px; overflow:hidden; }
  th,td { padding:8px 10px; text-align:left; border-bottom:1px solid #efe7dd; } th { background:${PLUM}; color:${IVORY}; font-size:11px; }
  td.r,th.r { text-align:right; white-space:nowrap; }
  tr.grand td { background:#f6efe2; font-weight:800; font-size:14px; }
  .balance { display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
  .balance.ok { background:#e7f3ea; color:#1f7a3d; } .balance.no { background:#fbe9e9; color:#9b2226; }
  .tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:8px 0; }
  .tile { background:#fff; border:1px solid #efe7dd; border-radius:10px; padding:12px; } .tile span { display:block; font-size:10.5px; letter-spacing:.04em; text-transform:uppercase; color:#6b5b73; } .tile strong { display:block; font-size:18px; margin-top:6px; }
  .tile.accent { background:${PLUM}; color:${IVORY}; border-color:${GOLD}; } .tile.accent span { color:${GOLD}; }
  .footer { margin-top:26px; padding-top:12px; border-top:1px solid #e6dccb; font-size:10.5px; color:#6b5b73; }
  @media print { .actions { display:none } body { padding:0; background:#fff } }
</style></head><body><div class="doc">
  <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
  <div class="cover">
    <div class="kicker">Veloria Grand · Premium Event Venues</div>
    <h1>${esc("Board & Investor Pack")}</h1>
    <div class="sub">Confidential financial summary, derived live from the posted ledger.</div>
    <div class="meta">
      <div class="m"><span>Entity</span><strong>Veloria Grand</strong></div>
      <div class="m"><span>Fiscal year</span><strong>${fyLabel}</strong></div>
      <div class="m"><span>Prepared</span><strong>${esc(today)}</strong></div>
      <div class="m"><span>Classification</span><strong>Board confidential</strong></div>
    </div>
  </div>

  <h2>Profit &amp; Loss summary</h2>
  <table><tbody>
    <tr><td>Total income</td><td class="r">${inr(pl.totalIncome)}</td></tr>
    <tr><td>Total expense</td><td class="r">${inr(pl.totalExpense)}</td></tr>
    <tr class="grand"><td>Net ${pl.netProfit >= 0 ? "profit" : "loss"}</td><td class="r">${inr(pl.netProfit)}</td></tr>
  </tbody></table>

  <h2>Balance Sheet summary</h2>
  <table><tbody>
    <tr><td>Total assets</td><td class="r">${inr(bs.totalAssets)}</td></tr>
    <tr><td>Total liabilities</td><td class="r">${inr(bs.totalLiabilities)}</td></tr>
    <tr><td>Total equity${bs.retainedEarnings ? " (incl. retained earnings)" : ""}</td><td class="r">${inr(bs.totalEquity)}</td></tr>
    <tr class="grand"><td>Liabilities + equity${bs.balanced ? '<span class="balance ok">Balanced</span>' : '<span class="balance no">Out of balance</span>'}</td><td class="r">${inr(bs.totalLiabilities + bs.totalEquity)}</td></tr>
  </tbody></table>

  <h2>Key metrics</h2>
  <div class="tiles">
    ${tile("Total income", inr(pl.totalIncome))}
    ${tile("Net result", inr(pl.netProfit), true)}
    ${tile("Net margin", margin + "%")}
    ${tile("Total assets", inr(bs.totalAssets))}
    ${tile("Retained earnings", inr(bs.retainedEarnings))}
    ${tile("Trial balance — debits", inr(tb.totalDebit))}
    ${tile("Trial balance — credits", inr(tb.totalCredit))}
    ${tile("Ledger integrity", tb.balanced ? "Balanced" : "Check required", tb.balanced)}
  </div>

  <div class="footer">Prepared by the Veloria Grand finance team for the board and investors. Figures are derived live from posted general-ledger entries${fy ? ` for ${fyLabel}` : ""} and are indicative pending final audit. Balance Sheet figures are cumulative to date.</div>
</div></body></html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
