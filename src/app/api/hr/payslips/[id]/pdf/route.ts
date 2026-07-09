import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { COMPANY_LEGAL_LINE, COMPANY_ADDRESS, COMPANY_GSTIN } from "@/lib/constants";

export const runtime = "nodejs";

// ============================================================
// Payslip — branded, print-to-PDF document.
// Rendered server-side from the frozen HrPayslip snapshot (empCodeSnap /
// nameSnap / earnings / deductions), so the payslip reflects the run exactly
// as it was computed.
//
// AUTH: allow if the requester is HR (session role has `hr:payroll`) OR the
// payslip belongs to the requester (payslip.employee.userId === session user
// id). Never leak another employee's payslip.
// ============================================================

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const inr = (n: number) => inrFmt.format(Math.round(n));

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// Indian-system number-to-words for the net-pay-in-words line.
function rupeesInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero Rupees Only";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const twoDigits = (x: number): string => {
    if (x < 20) return ones[x];
    return (tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "")).trim();
  };
  const threeDigits = (x: number): string => {
    const h = Math.floor(x / 100);
    const rest = x % 100;
    return [h ? ones[h] + " Hundred" : "", rest ? twoDigits(rest) : ""].filter(Boolean).join(" ");
  };
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;
  if (crore) parts.push(twoDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ").replace(/\s+/g, " ").trim() + " Rupees Only";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Please sign in to view this payslip.", { status: 401 });

  const slip = await prisma.hrPayslip.findUnique({
    where: { id },
    include: {
      run: { select: { fy: true, month: true, label: true, status: true } },
      // Resolve ownership via the linked user (payslip → employee → user).
      // employee relation is on HrPayslip via employeeId; pull userId + display.
    },
  });

  if (!slip) return new Response("Payslip not available.", { status: 404 });

  // Ownership check: is this payslip's employee linked to the requester?
  const isHr = hasPermission(session?.user?.role ?? "", "hr:payroll");
  let owns = false;
  let designationName: string | null = null;
  const employee = await prisma.employee.findUnique({
    where: { id: slip.employeeId },
    select: { userId: true, designation: { select: { name: true } } },
  });
  designationName = employee?.designation?.name ?? null;
  if (employee?.userId && employee.userId === userId) owns = true;

  if (!isHr && !owns) {
    return new Response("You are not allowed to view this payslip.", { status: 403 });
  }

  const earnings = Array.isArray(slip.earnings)
    ? (slip.earnings as Array<{ code?: string; name?: string; amount?: number }>)
    : [];
  const extraDeductions = Array.isArray(slip.deductions)
    ? (slip.deductions as Array<{ code?: string; name?: string; amount?: number }>)
    : [];

  const gross = Number(slip.gross);
  const net = Number(slip.net);
  const pf = Number(slip.pf);
  const esi = Number(slip.esi);
  const pt = Number(slip.pt);
  const tds = Number(slip.tds);

  // Statutory lines + any explicit deduction rows from the snapshot.
  const deductionRows: Array<{ name: string; amount: number }> = [];
  if (pf > 0) deductionRows.push({ name: "Provident Fund (PF)", amount: pf });
  if (esi > 0) deductionRows.push({ name: "Employee State Insurance (ESI)", amount: esi });
  if (pt > 0) deductionRows.push({ name: "Professional Tax (PT)", amount: pt });
  if (tds > 0) deductionRows.push({ name: "TDS (Income Tax)", amount: tds });
  for (const d of extraDeductions) {
    const amt = Number(d.amount ?? 0);
    if (amt > 0) deductionRows.push({ name: d.name || d.code || "Deduction", amount: amt });
  }
  const totalDeductions = deductionRows.reduce((s, d) => s + d.amount, 0);

  const monthLabel =
    slip.run.label ||
    `${MONTHS[(slip.run.month - 1 + 12) % 12]} ${slip.run.fy}`;

  const earningsRows = earnings.length
    ? earnings
        .map(
          (e) => `<tr>
        <td>${esc(e.name || e.code || "Earning")}</td>
        <td class="r">${inr(Number(e.amount ?? 0))}</td>
      </tr>`
        )
        .join("")
    : `<tr><td>Gross Earnings</td><td class="r">${inr(gross)}</td></tr>`;

  const deductionsRows = deductionRows.length
    ? deductionRows
        .map(
          (d) => `<tr>
        <td>${esc(d.name)}</td>
        <td class="r">${inr(d.amount)}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="2" class="muted">No deductions</td></tr>`;

  const detail = (label: string, value: string) =>
    `<div class="d"><span>${label}</span><strong>${esc(value)}</strong></div>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Payslip — ${esc(slip.nameSnap)} — ${esc(monthLabel)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: ${PLUM}; background: ${IVORY}; margin: 0; padding: 24px; }
  .doc { max-width: 820px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${GOLD}; padding-bottom: 14px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .brand small { display:block; font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: ${GOLD}; }
  .title { font-size: 15px; font-weight: 700; text-align: right; }
  .title small { display:block; font-weight: 500; color: #6b5b73; }
  .details { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 16px 0; font-size: 12.5px; }
  .d { display:flex; justify-content: space-between; border-bottom: 1px dashed #e6dccb; padding: 4px 0; }
  .d span { color: #6b5b73; }
  h2 { font-size: 13px; margin: 18px 0 8px; padding: 6px 10px; background: ${PLUM}; color: ${IVORY}; border-radius: 6px; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(45,27,61,.08); }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #efe7dd; }
  th { background: ${PLUM}; color: ${IVORY}; font-weight: 600; font-size: 11px; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  td.muted { color: #6b5b73; }
  tfoot td { font-weight: 700; background: #f6efe2; }
  .netbar { margin-top: 16px; background: ${PLUM}; color: ${IVORY}; border-radius: 10px; padding: 14px 18px; display:flex; justify-content: space-between; align-items: center; }
  .netbar .lbl { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: ${GOLD}; }
  .netbar .amt { font-size: 22px; font-weight: 800; }
  .words { margin-top: 8px; font-size: 11.5px; color: #4a3d52; font-style: italic; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e6dccb; font-size: 10.5px; color: #6b5b73; display:flex; justify-content: space-between; }
  .actions { text-align:center; margin: 8px 0 18px; }
  .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  @media print { .actions { display:none; } body { padding: 0; } }
  @media (max-width: 640px) { .cols { grid-template-columns: 1fr; } .details { grid-template-columns: 1fr; } }
</style></head>
<body>
  <div class="doc">
    <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
    <div class="header">
      <div class="brand"><img src="/logo.png" alt="Veloria Grand" style="height:44px;width:auto;display:block;margin-bottom:6px" onerror="this.style.display='none'"/>Veloria Grand<small>${esc(COMPANY_LEGAL_LINE)}</small><small>Premium Event Venues</small><small>${esc(COMPANY_ADDRESS)}</small>${COMPANY_GSTIN ? `<small>GSTIN: ${esc(COMPANY_GSTIN)}</small>` : ""}</div>
      <div class="title">Payslip<small>${esc(monthLabel)}</small></div>
    </div>

    <div class="details">
      ${detail("Employee", slip.nameSnap)}
      ${detail("Employee Code", slip.empCodeSnap)}
      ${detail("Designation", designationName || "—")}
      ${detail("Pay Period", monthLabel)}
      ${detail("Paid Days", String(Number(slip.paidDays)))}
      ${detail("LOP Days", String(Number(slip.lopDays)))}
    </div>

    <div class="cols">
      <div>
        <h2>Earnings</h2>
        <table>
          <thead><tr><th>Component</th><th class="r">Amount</th></tr></thead>
          <tbody>${earningsRows}</tbody>
          <tfoot><tr><td>Gross Earnings</td><td class="r">${inr(gross)}</td></tr></tfoot>
        </table>
      </div>
      <div>
        <h2>Deductions</h2>
        <table>
          <thead><tr><th>Component</th><th class="r">Amount</th></tr></thead>
          <tbody>${deductionsRows}</tbody>
          <tfoot><tr><td>Total Deductions</td><td class="r">${inr(totalDeductions)}</td></tr></tfoot>
        </table>
      </div>
    </div>

    <div class="netbar">
      <span class="lbl">Net Pay</span>
      <span class="amt">${inr(net)}</span>
    </div>
    <p class="words">Net Pay in words: ${esc(rupeesInWords(net))}</p>

    <div class="footer">
      <span>This is a computer-generated payslip and does not require a signature.</span>
      <span>${esc(COMPANY_LEGAL_LINE)}</span>
    </div>
  </div>
</body></html>`;

  // `inline` disposition so Safari renders the branded page in-tab (where the
  // employee can "Save as PDF / Print") instead of downloading raw text.
  const safeName = `Payslip-${slip.empCodeSnap}-${monthLabel}`.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${safeName}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
