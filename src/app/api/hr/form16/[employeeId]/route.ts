import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { newRegimeAnnualTax, DEFAULT_STAT_CONFIG } from "@/lib/hr/payroll-calc";
import { COMPANY_LEGAL_LINE, COMPANY_ADDRESS, COMPANY_GSTIN } from "@/lib/constants";

export const runtime = "nodejs";

// ============================================================
// Form-16 Part B (computation summary) — branded, print-to-PDF page.
// This is NOT the TRACES-issued statutory Form-16; it is an internal
// computation summary generated from the employee's payslips.
// Access: hr:payroll OR the employee themselves (Employee.userId).
// ?fy=2026-27 selects the financial year (defaults to the latest run).
// ============================================================

const PLUM = "#2D1B3D";
const GOLD = "#C9A96E";
const IVORY = "#FAF7F2";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export async function GET(req: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response("Not authenticated.", { status: 401 });

  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true, empCode: true, firstName: true, lastName: true, userId: true,
      dateOfJoining: true, dateOfExit: true,
      legalEntity: { select: { name: true } },
    },
  });
  if (!emp) return new Response("Employee not found.", { status: 404 });

  // Authorization: payroll admins, or the employee viewing their own Form-16.
  const isSelf = !!emp.userId && emp.userId === session.user.id;
  const isPayroll = hasPermission(session.user.role ?? "", "hr:payroll");
  if (!isSelf && !isPayroll) return new Response("Not authorized.", { status: 403 });

  // Resolve the financial year (query param, else latest run for this employee).
  const url = new URL(req.url);
  let fy = url.searchParams.get("fy")?.trim() || "";
  if (!fy) {
    const latest = await prisma.hrPayslip.findFirst({
      where: { employeeId },
      orderBy: { run: { fy: "desc" } },
      select: { run: { select: { fy: true } } },
    });
    fy = latest?.run.fy || "";
  }
  if (!fy) return new Response("No payroll history for this employee.", { status: 404 });

  const slips = await prisma.hrPayslip.findMany({
    where: { employeeId, run: { fy } },
    select: { gross: true, pf: true, pt: true, tds: true, run: { select: { label: true, month: true } } },
    orderBy: { run: { month: "asc" } },
  });
  if (slips.length === 0) return new Response(`No payslips for FY ${esc(fy)}.`, { status: 404 });

  const grossSalary = slips.reduce((s, x) => s + Number(x.gross), 0);
  const ptTotal = slips.reduce((s, x) => s + Number(x.pt), 0);
  const tdsDeducted = slips.reduce((s, x) => s + Number(x.tds), 0);
  const stdDeduction = DEFAULT_STAT_CONFIG.stdDeductionAnnual;
  // Professional tax is deductible from salary income (Sec 16(iii)).
  const taxableIncome = Math.max(0, grossSalary - stdDeduction - ptTotal);
  const taxComputed = newRegimeAnnualTax(taxableIncome);

  const name = `${emp.firstName} ${emp.lastName}`;
  const monthRows = slips
    .map(
      (x) => `<tr>
        <td>${esc(x.run.label)}</td>
        <td class="r">${inr(Number(x.gross))}</td>
        <td class="r">${inr(Number(x.tds))}</td>
      </tr>`,
    )
    .join("");

  const row = (label: string, value: string, strong = false) =>
    `<tr${strong ? ' class="grand"' : ""}><td>${esc(label)}</td><td class="r">${value}</td></tr>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Form 16 (Part B) — ${esc(name)} — FY ${esc(fy)}</title>
<style>
  @page { size: A4 portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: ${PLUM}; background: ${IVORY}; margin: 0; padding: 24px; }
  .doc { max-width: 820px; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid ${GOLD}; padding-bottom: 14px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .brand small { display:block; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #6b5b73; }
  .title { font-size: 15px; font-weight: 700; text-align: right; }
  .title small { display:block; font-weight: 500; color: #6b5b73; }
  .banner { margin: 14px 0; padding: 8px 12px; background: #fff6e6; border: 1px solid ${GOLD}; border-radius: 8px; font-size: 11.5px; color: #7a5a12; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .party { border: 1px solid #e6dccb; border-radius: 8px; padding: 12px; background:#fff; font-size: 12px; line-height: 1.6; }
  .party h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: ${GOLD}; }
  h2 { font-size: 13px; margin: 18px 0 8px; padding: 6px 10px; background: ${PLUM}; color: ${IVORY}; border-radius: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(45,27,61,.08); }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #efe7dd; }
  th { background: ${PLUM}; color: ${IVORY}; font-weight: 600; font-size: 11px; }
  td.r, th.r { text-align: right; white-space: nowrap; }
  tr.grand td { background: #f6efe2; color: ${PLUM}; font-weight: 800; font-size: 14px; }
  .footer { margin-top: 22px; padding-top: 12px; border-top: 1px solid #e6dccb; font-size: 10.5px; color: #6b5b73; }
  .actions { text-align:center; margin: 8px 0 18px; }
  .actions button { background:${PLUM}; color:${IVORY}; border:0; padding:9px 18px; border-radius:8px; font-weight:600; cursor:pointer; }
  @media print { .actions { display:none; } body { padding: 0; } }
</style></head>
<body>
  <div class="doc">
    <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
    <div class="header">
      <div class="brand"><img src="/logo.png" alt="Veloria Grand" style="height:44px;width:auto;display:block;margin-bottom:6px" onerror="this.style.display='none'"/>Veloria Grand<small>${esc(COMPANY_LEGAL_LINE)}</small></div>
      <div class="title">Form 16 — Part B<small>Computation summary · FY ${esc(fy)}</small></div>
    </div>

    <div class="banner">
      <strong>Part B — computation summary (not a substitute for the TRACES-issued Form-16).</strong>
      This internal statement is generated from the employee's payslips under the New Tax Regime and is provided for reference only.
    </div>

    <div class="parties">
      <div class="party">
        <h3>Employer</h3>
        <strong>Veloria Grand</strong><br/>
        ${esc(COMPANY_LEGAL_LINE)}<br/>
        ${esc(COMPANY_ADDRESS)}<br/>
        GSTIN: ${esc(COMPANY_GSTIN)}
      </div>
      <div class="party">
        <h3>Employee</h3>
        <strong>${esc(name)}</strong><br/>
        Emp code: ${esc(emp.empCode)}<br/>
        ${emp.legalEntity ? `Entity: ${esc(emp.legalEntity.name)}<br/>` : ""}
        Financial year: ${esc(fy)}
      </div>
    </div>

    <h2>Computation of income &amp; tax (New Regime)</h2>
    <table>
      <tbody>
        ${row("Gross salary paid", inr(grossSalary))}
        ${row("Less: Standard deduction (Sec 16(ia))", "− " + inr(stdDeduction))}
        ${row("Less: Professional tax (Sec 16(iii))", "− " + inr(ptTotal))}
        ${row("Taxable income", inr(taxableIncome), true)}
        ${row("Income tax computed (incl. cess)", inr(taxComputed))}
        ${row("Total TDS deducted &amp; deposited", inr(tdsDeducted), true)}
      </tbody>
    </table>

    <h2>Monthly TDS detail</h2>
    <table>
      <thead><tr><th>Month</th><th class="r">Gross</th><th class="r">TDS</th></tr></thead>
      <tbody>${monthRows}</tbody>
    </table>

    <div class="footer">
      Tax computed under the New Tax Regime (FY defaults per <em>DEFAULT_STAT_CONFIG</em>); actual year-end liability depends on the employee's declarations, proofs and other income. The TDS figure reflects amounts deducted through payroll. For the statutory Form-16, refer to the certificate downloaded from the TRACES portal.
    </div>
  </div>
</body></html>`;

  const safeName = `${emp.empCode}-Form16-${fy}`.replace(/[^a-zA-Z0-9._-]+/g, "-");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${safeName}.html"`,
      "Cache-Control": "no-store",
    },
  });
}
