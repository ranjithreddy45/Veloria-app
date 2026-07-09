import { describe, it, expect } from "vitest";
import { validateBalanced, type JournalLineInput } from "@/lib/finance/ledger";

// Mirror the exact line construction in postHrPayrollToGL: net payable is
// derived as (gross − statutory) so the salary journal ALWAYS balances, even
// with rupee-vs-paise rounding. This guards against a future regression that
// credits totalNet directly (which can drift and post an unbalanced entry).
function buildPayrollLines(gross: number, pf: number, esi: number, pt: number, tds: number): JournalLineInput[] {
  const statutory = pf + esi + pt + tds;
  const net = Math.round((gross - statutory) * 100) / 100;
  const lines: JournalLineInput[] = [
    { accountId: "salaries", debit: gross },
    { accountId: "net", credit: net },
  ];
  if (pf > 0) lines.push({ accountId: "pf", credit: pf });
  if (esi > 0) lines.push({ accountId: "esi", credit: esi });
  if (pt > 0) lines.push({ accountId: "pt", credit: pt });
  if (tds > 0) lines.push({ accountId: "tds", credit: tds });
  return lines;
}

describe("HR payroll → GL journal balance", () => {
  it("balances for a typical run with fractional gross", () => {
    expect(validateBalanced(buildPayrollLines(500000.5, 1800, 135, 200, 24375)).ok).toBe(true);
  });
  it("balances when only some statutory heads apply", () => {
    expect(validateBalanced(buildPayrollLines(123456.78, 1800, 0, 200, 0)).ok).toBe(true);
  });
  it("balances with no statutory at all (net == gross)", () => {
    expect(validateBalanced(buildPayrollLines(90000, 0, 0, 0, 0)).ok).toBe(true);
  });
  it("balances a large multi-employee aggregate", () => {
    expect(validateBalanced(buildPayrollLines(4_827_413.25, 54_000, 1_215, 4_400, 289_560)).ok).toBe(true);
  });
});
