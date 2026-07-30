import { prisma } from "@/lib/prisma";
import {
  isRevenueMarginGrid,
  type AnyProjectionGrid,
  type RevenueMarginGrid,
  type RmCaseRow,
  type YearRow,
} from "@/lib/acq/projection-calc";

export const runtime = "nodejs";

// ============================================================
// Owner projection — branded, print-to-PDF document.
// Rendered server-side from the FROZEN snapshot (outputsJson), so what
// BD Head approved is exactly what the owner sees. Accessible by the
// unguessable id for APPROVED/SENT projections (owner has no login).
// WITHOUT-FOOD output never renders any food/decor/marketing row.
// ============================================================

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";

const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");
const pct = (n: number) => (n * 100).toFixed(1) + "%";
const num1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-IN");

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function gridTable(rows: YearRow[], withFood: boolean): string {
  const line = (label: string, vals: string[], emphasize = false) => `
    <tr class="${emphasize ? "emph" : ""}">
      <td class="rowlabel">${label}</td>
      ${vals.map((v) => `<td>${v}</td>`).join("")}
    </tr>`;
  // Derive the actual fee percentages from the frozen amounts so the labels
  // never lie if a deal uses non-default rates (baseFee = revenue × base%;
  // incentiveFee = GOP × incentive%). Constant across years — read first row
  // with a non-zero denominator.
  const rRev = rows.find((r) => r.totalRevenue > 0);
  const basePct = rRev ? Math.round((rRev.baseFee / rRev.totalRevenue) * 100) : 5;
  const rGop = rows.find((r) => r.gop > 0);
  const incPct = rGop ? Math.round((rGop.incentiveFee / rGop.gop) * 100) : 20;
  return `
  <table class="grid">
    <thead>
      <tr><th class="rowlabel">Particulars</th>${rows.map((r) => `<th>Year ${r.year}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${line("No. of Events / Month", rows.map((r) => num1(r.events)))}
      ${withFood ? line("Per Plate Charges", rows.map((r) => inr(r.perPlate ?? 0))) : ""}
      ${line("Revenue Per Event", rows.map((r) => inr(r.revPerEvent)))}
      ${line("Total Revenue", rows.map((r) => inr(r.totalRevenue)))}
      ${line("Total Operating Expense", rows.map((r) => inr(r.opex)))}
      ${line("Gross Operating Profit (GOP)", rows.map((r) => inr(r.gop)))}
      ${line(`Base Fee (${basePct}%)`, rows.map((r) => inr(r.baseFee)))}
      ${line(`Incentive Fee (${incPct}%)`, rows.map((r) => inr(r.incentiveFee)))}
      ${line("Total Management Fee", rows.map((r) => inr(r.mgmtFee)))}
      ${line("Net Owner's Return", rows.map((r) => inr(r.netOwnerReturn)), true)}
      ${line("Owner's Return %", rows.map((r) => pct(r.ownerReturnPct)), true)}
    </tbody>
  </table>`;
}

// ---- REVENUE_MARGIN document body -------------------------------------
// The owner reads this. Two rules drive the layout:
//   1. The headline is the FULL GROSS event value — never presented as profit,
//      because no operating expenses are deducted anywhere in this model.
//   2. Veloria's margin is a physically separate block, labelled as ours, so it
//      can never be mistaken for the owner's revenue.
function rmCaseTable(grid: RevenueMarginGrid, row: RmCaseRow): string {
  const perPax = grid.priceBasis === "PER_PAX";
  const line = (label: string, value: string, emphasize = false) => `
    <tr class="${emphasize ? "emph" : ""}">
      <td class="rowlabel">${label}</td><td>${value}</td>
    </tr>`;
  return `
  <table class="grid two">
    <thead><tr><th class="rowlabel">Particulars</th><th>Amount</th></tr></thead>
    <tbody>
      ${line(perPax ? "Price per guest (pax)" : "Price per event", inr(row.price))}
      ${perPax ? line("Billable guests per event", num1(row.pax)) : ""}
      ${line("Events per month", num1(row.eventsPerMonth))}
      ${line("Gross event value — per event", inr(row.revenuePerEvent))}
      ${line("Gross event value — per month", inr(row.monthlyRevenue))}
      ${line("Gross event value — per year", inr(row.annualRevenue), true)}
    </tbody>
  </table>`;
}

function rmMarginTable(grid: RevenueMarginGrid): string {
  const perPax = grid.priceBasis === "PER_PAX";
  const line = (label: string, value: string, emphasize = false) => `
    <tr class="${emphasize ? "emph" : ""}">
      <td class="rowlabel">${label}</td><td>${value}</td>
    </tr>`;
  return `
  <table class="grid two">
    <thead><tr><th class="rowlabel">Particulars</th><th>Amount</th></tr></thead>
    <tbody>
      ${line(perPax ? "Spread per guest (pax)" : "Spread per event", inr(grid.margin.spreadPerUnit))}
      ${line("Margin per event", inr(grid.margin.perEvent))}
      ${line("Margin per month", inr(grid.margin.monthly))}
      ${line("Margin per year", inr(grid.margin.annual), true)}
    </tbody>
  </table>`;
}

function rmBody(grid: RevenueMarginGrid): string {
  const basis = grid.priceBasis === "PER_PAX" ? "Per-guest (pax) pricing" : "Per-event pricing";
  const paxNote =
    grid.priceBasis === "PER_PAX"
      ? ` Billable guests per event: ${num1(grid.effectivePax)}${
          grid.paxBinding === "CAPACITY"
            ? " (capped at the hall's capacity)"
            : grid.paxBinding === "MINIMUM"
              ? " (at the agreed minimum guest count)"
              : ""
        }.`
      : "";
  return `
    <div class="modeltag">Revenue Margin Model · ${basis} · No operating expenses included</div>

    <h2>Base Case — at your guaranteed price</h2>
    ${rmCaseTable(grid, grid.base)}
    <div class="note">The guaranteed price is what Veloria Grand commits to you per
      ${grid.priceBasis === "PER_PAX" ? "guest" : "event"}, irrespective of what the event is finally sold for.${paxNote}</div>

    <h2>Best Case — at the expected market price</h2>
    ${rmCaseTable(grid, grid.best)}
    <div class="note">Indicative price we expect to achieve in the market. It is
      shown so the full event value is transparent to you.</div>

    <h2>Veloria Grand&rsquo;s margin — not part of your guaranteed amount</h2>
    ${rmMarginTable(grid)}
    <div class="note"><strong>This margin is Veloria Grand&rsquo;s, not yours.</strong> It is the
      difference between the guaranteed price above and the expected market price
      &mdash; it is not additional revenue to you, and it is not deducted from your
      guaranteed amount either.</div>

    <div class="note" style="font-style:normal;margin-top:14px">
      <strong>No operating expenses are included in this document.</strong> Every figure
      above is gross event value, not profit: electricity, staffing, housekeeping,
      food, décor, marketing and all other running costs are outside this model
      and are not deducted from any number shown here.
    </div>`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projection = await prisma.acqProjection.findUnique({
    where: { id },
    include: { deal: { select: { propertyName: true, locality: true, name: true } } },
  });

  if (!projection || !projection.outputsJson) {
    return new Response("Projection not available.", { status: 404 });
  }
  if (projection.status !== "APPROVED" && projection.status !== "SENT") {
    return new Response("This projection is not finalized.", { status: 403 });
  }

  const grid = projection.outputsJson as unknown as AnyProjectionGrid;
  // Revenue-Margin projections are a different document (no years, no fees, no
  // opex) — they render their own body below.
  const isRm = isRevenueMarginGrid(grid);
  const withFood = grid.modelType === "WITH_FOOD";
  const property = esc(projection.deal.propertyName);
  const docTitle = isRm ? "Revenue Projection" : "3-Year Revenue Projection";
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${docTitle} — ${property}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: ${PLUM}; background: ${IVORY}; margin: 0; padding: 24px; }
  .doc { max-width: 1100px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${GOLD}; padding-bottom: 14px; margin-bottom: 6px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .brand small { display:block; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: ${GOLD}; }
  .title { font-size: 15px; font-weight: 700; text-align: right; }
  .title small { display:block; font-weight: 500; color: #6b5b73; }
  .modeltag { display:inline-block; margin: 14px 0 4px; font-size: 11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color: ${GOLD}; }
  h2 { font-size: 14px; margin: 18px 0 8px; padding: 6px 10px; background: ${PLUM}; color: ${IVORY}; border-radius: 6px; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(45,27,61,.08); }
  table.grid th, table.grid td { padding: 7px 10px; text-align: right; border-bottom: 1px solid #efe7dd; white-space: nowrap; }
  table.grid th { background: ${PLUM}; color: ${IVORY}; font-weight: 600; font-size: 11px; }
  table.grid th.rowlabel, table.grid td.rowlabel { text-align: left; font-weight: 600; }
  table.grid tr.emph td { background: #f6efe2; color: ${PLUM}; font-weight: 800; }
  /* Two-column (Particulars / Amount) layout used by the Revenue-Margin doc. */
  table.grid.two { max-width: 620px; }
  table.grid.two td.rowlabel, table.grid.two th.rowlabel { width: 62%; }
  .note { font-size: 11px; color: #6b5b73; margin: 6px 2px 0; font-style: italic; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e6dccb; font-size: 10.5px; color: #6b5b73; display:flex; justify-content: space-between; }
  .actions { text-align:center; margin: 8px 0 18px; }
  .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  @media print { .actions { display:none; } body { padding: 0; } }
</style></head>
<body>
  <div class="doc">
    <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
    <div class="header">
      <div class="brand">Veloria Grand<small>Premium Event Venues</small></div>
      <div class="title">${docTitle}<small>${property} · ${esc(projection.deal.locality)}</small></div>
    </div>
    ${
      isRm
        ? rmBody(grid)
        : `<div class="modeltag">${withFood ? "With In-House Food" : "Hall-Only (Without Food)"} Model · Management Fee 5% Revenue + 20% GOP</div>

    <h2>Base Case</h2>
    ${gridTable(grid.base, withFood)}
    <div class="note">${
      withFood
        ? "Includes food revenue; owner supplies catering."
        : "Food, décor &amp; marketing managed by Billion Events — not reflected in owner economics."
    }</div>

    <h2>Best Case</h2>
    ${gridTable(grid.best, withFood)}`
    }

    <div class="footer">
      <span>Indicative projection. Actuals vary with bookings &amp; seasonality.</span>
      <span>Generated ${today} · ${esc(projection.deal.name)} · v${projection.version}</span>
    </div>
  </div>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
