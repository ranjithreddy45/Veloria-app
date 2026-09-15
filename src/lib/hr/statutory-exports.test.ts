import { describe, it, expect } from "vitest";
import {
  buildPfEcrFile,
  buildEsiReturnFile,
  buildTds24qFile,
  computeEcrLine,
  formatEcrLine,
  sanitizeEcrName,
  quarterMonths,
  lastDayOfMonth,
  formatDDMMYYYY,
  ESI_MC_HEADERS,
  TDS_24Q_HEADERS,
  PAN_NOT_AVAILABLE,
  type EcrConfig,
  type EcrMemberInput,
  type EsiMemberInput,
} from "./statutory-exports";

// ============================================================
// Filing exports — a wrong field order or a mis-capped wage is a rejected (or
// worse, a wrongly-remitted) return, so the exact bytes are asserted.
// ============================================================

const ECR_CFG: EcrConfig = {
  pfRatePct: 12,
  pfWageCeiling: 15000,
  pfOnFullBasic: false,
  epsWageCeiling: 15000,
  epsApplicable: true,
  edliWageCeiling: 15000,
};

/** A regular member: basic ₹18,000 → PF wages capped at 15,000. */
const RAVI: EcrMemberInput = {
  empCode: "E001",
  name: "Ravi Kumar-S.",
  uan: "100200300400",
  grossWages: 30000,
  pfWageBase: 18000,
  employeePf: 1800,
  employerEps: 1250,
  employerEpf: 550,
  ncpDays: 0,
};

describe("PF ECR — line format", () => {
  it("emits the 11 EPFO fields in order, #~#-separated, integers, uppercase name", () => {
    const line = formatEcrLine(computeEcrLine(RAVI, ECR_CFG));
    expect(line).toBe("100200300400#~#RAVI KUMAR S#~#30000#~#15000#~#15000#~#15000#~#1800#~#1250#~#550#~#0#~#0");
    expect(line.split("#~#")).toHaveLength(11);
  });

  it("joins members with CRLF, no header row, no trailing newline", () => {
    const file = buildPfEcrFile({
      fy: "2026-27",
      month: 7,
      members: [RAVI, { ...RAVI, empCode: "E002", name: "Meena", uan: "200300400500" }],
      cfgFor: () => ECR_CFG,
    });
    expect(file.fileName).toBe("ECR_202607.txt");
    expect(file.mimeType).toBe("text/plain");
    expect(file.rowCount).toBe(2);
    expect(file.content.split("\r\n")).toHaveLength(2);
    expect(file.content.startsWith("100200300400#~#")).toBe(true);
    expect(file.content.endsWith("\r\n")).toBe(false);
    expect(file.content).not.toMatch(/(?<!\r)\n/);
    expect(file.warnings).toEqual([]);
  });

  it("file names roll to the second calendar year for Jan–Mar", () => {
    expect(buildPfEcrFile({ fy: "2026-27", month: 1, members: [], cfgFor: () => ECR_CFG }).fileName).toBe("ECR_202701.txt");
  });

  it("strips special characters and collapses spaces in the member name", () => {
    expect(sanitizeEcrName("  d'Souza,  José  ")).toBe("D SOUZA JOS");
    expect(sanitizeEcrName("Mohd. Ali-Khan (Jr)")).toBe("MOHD ALI KHAN JR");
  });

  it("rounds every figure to a whole rupee", () => {
    const l = computeEcrLine({ ...RAVI, grossWages: 30000.49, employeePf: 1799.6, ncpDays: 0 }, ECR_CFG);
    expect(l.grossWages).toBe(30000);
    expect(l.employeePf).toBe(1800);
  });
});

describe("PF ECR — EPS / EPF / EDLI caps", () => {
  it("caps EPF, EPS and EDLI wages at the statutory ceiling by default", () => {
    const l = computeEcrLine({ ...RAVI, pfWageBase: 42000 }, ECR_CFG);
    expect(l.epfWages).toBe(15000);
    expect(l.epsWages).toBe(15000);
    expect(l.edliWages).toBe(15000);
  });

  it("reports full basic as EPF wages when PF runs on full basic, but STILL caps EPS and EDLI", () => {
    const cfg = { ...ECR_CFG, pfOnFullBasic: true };
    const l = computeEcrLine(
      { ...RAVI, pfWageBase: 40000, employeePf: 4800, employerEps: 1250, employerEpf: 3550 },
      cfg,
    );
    expect(l.epfWages).toBe(40000);
    expect(l.epsWages).toBe(15000);
    expect(l.edliWages).toBe(15000);
    expect(formatEcrLine(l)).toBe("100200300400#~#RAVI KUMAR S#~#30000#~#40000#~#15000#~#15000#~#4800#~#1250#~#3550#~#0#~#0");
  });

  it("honours a configured EPS ceiling other than ₹15,000", () => {
    const cfg = { ...ECR_CFG, pfOnFullBasic: true, epsWageCeiling: 20000 };
    const l = computeEcrLine({ ...RAVI, pfWageBase: 25000, employerEps: 1666 }, cfg);
    expect(l.epsWages).toBe(20000);
  });

  it("reports 0 EPS wages for a member with no pension contribution (non-EPS member / EPS off)", () => {
    const noEps = computeEcrLine({ ...RAVI, employerEps: 0, employerEpf: 1800 }, ECR_CFG);
    expect(noEps.epsWages).toBe(0);
    const cfgOff = computeEcrLine(RAVI, { ...ECR_CFG, epsApplicable: false });
    expect(cfgOff.epsWages).toBe(0);
  });

  it("a zero-pay month is still a line: zero wages, NCP = the LOP days", () => {
    const l = computeEcrLine(
      { ...RAVI, grossWages: 0, pfWageBase: 0, employeePf: 0, employerEps: 0, employerEpf: 0, ncpDays: 30 },
      ECR_CFG,
    );
    expect(formatEcrLine(l)).toBe("100200300400#~#RAVI KUMAR S#~#0#~#0#~#0#~#0#~#0#~#0#~#0#~#30#~#0");
  });
});

describe("PF ECR — warnings (never silently drop)", () => {
  it("keeps a member with no UAN in the file (blank field) and names them in warnings", () => {
    const file = buildPfEcrFile({ fy: "2026-27", month: 7, members: [{ ...RAVI, uan: null }], cfgFor: () => ECR_CFG });
    expect(file.rowCount).toBe(1);
    expect(file.content.startsWith("#~#RAVI KUMAR S#~#")).toBe(true);
    expect(file.warnings).toHaveLength(1);
    expect(file.warnings[0]).toMatch(/E001 Ravi Kumar-S\.: UAN missing/);
  });

  it("warns on a UAN that is not 12 digits (and strips non-digits first)", () => {
    const file = buildPfEcrFile({ fy: "2026-27", month: 7, members: [{ ...RAVI, uan: "1002 0030" }], cfgFor: () => ECR_CFG });
    expect(file.content.startsWith("10020030#~#")).toBe(true);
    expect(file.warnings[0]).toMatch(/not 12 digits/);
  });

  it("warns when the employee PF does not equal the PF rate on EPF wages", () => {
    const file = buildPfEcrFile({ fy: "2026-27", month: 7, members: [{ ...RAVI, employeePf: 2100 }], cfgFor: () => ECR_CFG });
    expect(file.warnings).toHaveLength(1);
    expect(file.warnings[0]).toMatch(/employee PF ₹2100 ≠ 12% of EPF wages ₹15000 \(expected ₹1800\)/);
  });

  it("tolerates ±1 rupee rounding between contribution and wages", () => {
    const file = buildPfEcrFile({ fy: "2026-27", month: 7, members: [{ ...RAVI, employeePf: 1801 }], cfgFor: () => ECR_CFG });
    expect(file.warnings).toEqual([]);
  });

  it("rounds fractional NCP days and says so", () => {
    const file = buildPfEcrFile({ fy: "2026-27", month: 7, members: [{ ...RAVI, ncpDays: 1.5 }], cfgFor: () => ECR_CFG });
    expect(file.content.split("#~#")[9]).toBe("2");
    expect(file.warnings[0]).toMatch(/NCP days 1.5 rounded to 2/);
  });

  it("applies per-member config (multi-entity payroll)", () => {
    const file = buildPfEcrFile({
      fy: "2026-27",
      month: 7,
      members: [RAVI, { ...RAVI, empCode: "E009", uan: "300400500600", pfWageBase: 18000, employeePf: 2160, employerEps: 1250, employerEpf: 910 }],
      cfgFor: (m) => (m.empCode === "E009" ? { ...ECR_CFG, pfOnFullBasic: true } : ECR_CFG),
    });
    const [a, b] = file.content.split("\r\n");
    expect(a.split("#~#")[3]).toBe("15000");
    expect(b.split("#~#")[3]).toBe("18000");
    expect(file.warnings).toEqual([]);
  });
});

// ------------------------------------------------------------
// ESI
// ------------------------------------------------------------
const ESI_CFG = { esiGrossCeiling: 21000 };
const ASHA: EsiMemberInput = {
  empCode: "E010",
  name: "Asha D'Souza",
  ipNumber: "1234567890",
  paidDays: 30,
  esiWages: 18000,
  eligibilityWage: 18000,
  employeeEsi: 135,
  employerEsi: 585,
  lastWorkingDay: null,
};

describe("ESI monthly contribution", () => {
  it("writes the six ESIC template headers and one row per covered IP, CRLF", () => {
    const file = buildEsiReturnFile({ fy: "2026-27", month: 7, members: [ASHA], cfgFor: () => ESI_CFG });
    const lines = file.content.split("\r\n");
    expect(lines[0]).toBe(ESI_MC_HEADERS.join(","));
    expect(lines[0].startsWith("IP Number (10 Digits),IP Name ( Only alphabets and space ),No of Days")).toBe(true);
    expect(lines[1]).toBe("1234567890,Asha D Souza,30,18000,0,");
    expect(file.fileName).toBe("ESI_MC_202607.csv");
    expect(file.mimeType).toBe("text/csv");
    expect(file.rowCount).toBe(1);
    expect(file.warnings).toEqual([]);
  });

  it("filters to employees within the ESI wage ceiling (inclusive)", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [
        ASHA,
        { ...ASHA, empCode: "E011", name: "At Ceiling", ipNumber: "1111111111", eligibilityWage: 21000, esiWages: 21000 },
        { ...ASHA, empCode: "E012", name: "Above", ipNumber: null, eligibilityWage: 21001, esiWages: 21001, employeeEsi: 0, employerEsi: 0 },
      ],
      cfgFor: () => ESI_CFG,
    });
    expect(file.rowCount).toBe(2);
    expect(file.content).toContain("At Ceiling");
    expect(file.content).not.toContain("Above");
    expect(file.warnings).toEqual([]); // no IP number → nothing to warn about
  });

  it("uses the FULL contractual wage for coverage, not the LOP-reduced paid wage", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [{ ...ASHA, paidDays: 10, esiWages: 8000, eligibilityWage: 24000, employeeEsi: 0, employerEsi: 0 }],
      cfgFor: () => ESI_CFG,
    });
    expect(file.rowCount).toBe(0);
  });

  it("keeps an employee above the ceiling when payroll actually contributed (mid-period coverage)", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [{ ...ASHA, eligibilityWage: 23000, esiWages: 23000, employeeEsi: 173, employerEsi: 748 }],
      cfgFor: () => ESI_CFG,
    });
    expect(file.rowCount).toBe(1);
  });

  it("warns when an employee with an IP number is excluded by the ceiling", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [{ ...ASHA, eligibilityWage: 30000, esiWages: 30000, employeeEsi: 0, employerEsi: 0 }],
      cfgFor: () => ESI_CFG,
    });
    expect(file.rowCount).toBe(0);
    expect(file.warnings[0]).toMatch(/has IP number 1234567890 but monthly wage ₹30000 is above the ESI ceiling ₹21000/);
  });

  it("honours a per-entity ceiling", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [{ ...ASHA, eligibilityWage: 24000, employeeEsi: 0, employerEsi: 0 }],
      cfgFor: () => ({ esiGrossCeiling: 25000 }),
    });
    expect(file.rowCount).toBe(1);
  });

  it("keeps rows with a missing or malformed IP number and warns", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [{ ...ASHA, ipNumber: null }, { ...ASHA, empCode: "E013", ipNumber: "12-345" }],
      cfgFor: () => ESI_CFG,
    });
    expect(file.rowCount).toBe(2);
    expect(file.content.split("\r\n")[1].startsWith(",Asha D Souza,")).toBe(true);
    expect(file.warnings[0]).toMatch(/E010 Asha D'Souza: ESI IP number missing/);
    expect(file.warnings[1]).toMatch(/IP number "12345" is not 10 digits/);
  });

  it("zero wage days → reason code 1 (without wages), or 2 with the last working day on exit", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [
        { ...ASHA, paidDays: 0, esiWages: 0, employeeEsi: 0, employerEsi: 0 },
        { ...ASHA, empCode: "E014", ipNumber: "2222222222", paidDays: 0, esiWages: 0, employeeEsi: 0, employerEsi: 0, lastWorkingDay: new Date(Date.UTC(2026, 6, 5)) },
      ],
      cfgFor: () => ESI_CFG,
    });
    const [, a, b] = file.content.split("\r\n");
    expect(a).toBe("1234567890,Asha D Souza,0,0,1,");
    expect(b).toBe("2222222222,Asha D Souza,0,0,2,05/07/2026");
    expect(file.warnings.filter((w) => /zero wage days/.test(w))).toHaveLength(2);
  });

  it("fills last working day (DD/MM/YYYY) for an exit in a month that still had paid days", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [{ ...ASHA, paidDays: 12, esiWages: 7200, lastWorkingDay: new Date(Date.UTC(2026, 6, 12)) }],
      cfgFor: () => ESI_CFG,
    });
    expect(file.content.split("\r\n")[1]).toBe("1234567890,Asha D Souza,12,7200,0,12/07/2026");
  });

  it("rounds fractional paid days and rupees, and says so", () => {
    const file = buildEsiReturnFile({
      fy: "2026-27",
      month: 7,
      members: [{ ...ASHA, paidDays: 27.5, esiWages: 16500.4 }],
      cfgFor: () => ESI_CFG,
    });
    expect(file.content.split("\r\n")[1]).toBe("1234567890,Asha D Souza,28,16500,0,");
    expect(file.warnings[0]).toMatch(/paid days 27.5 rounded to 28/);
  });
});

// ------------------------------------------------------------
// TDS 24Q
// ------------------------------------------------------------
describe("TDS Form 24Q helper", () => {
  const month = (m: number, rows: { empCode: string; name: string; pan: string | null; amountPaid: number; tdsDeducted: number }[]) => ({ month: m, rows });
  const raj = { empCode: "E020", name: "Raj Mehta", pan: "abcde1234f", amountPaid: 80000, tdsDeducted: 5000 };

  it("maps quarters to Indian FY months", () => {
    expect(quarterMonths(1)).toEqual([4, 5, 6]);
    expect(quarterMonths(2)).toEqual([7, 8, 9]);
    expect(quarterMonths(3)).toEqual([10, 11, 12]);
    expect(quarterMonths(4)).toEqual([1, 2, 3]);
    expect(quarterMonths(5)).toEqual([]);
  });

  it("assumes the last day of the month as date of payment, in the right calendar year", () => {
    expect(formatDDMMYYYY(lastDayOfMonth("2026-27", 6))).toBe("30/06/2026");
    expect(formatDDMMYYYY(lastDayOfMonth("2026-27", 2))).toBe("28/02/2027");
    expect(formatDDMMYYYY(lastDayOfMonth("2027-28", 2))).toBe("29/02/2028");
  });

  it("writes Section 192 rows with an uppercase PAN and deposited = deducted by default", () => {
    const file = buildTds24qFile({ fy: "2026-27", quarter: 1, months: [month(4, [raj]), month(5, [raj]), month(6, [raj])] });
    const lines = file.content.split("\r\n");
    expect(lines[0]).toBe(TDS_24Q_HEADERS.join(","));
    expect(lines[1]).toBe("ABCDE1234F,Raj Mehta,192,30/04/2026,80000,5000,5000");
    expect(lines[2]).toBe("ABCDE1234F,Raj Mehta,192,31/05/2026,80000,5000,5000");
    expect(lines[3]).toBe("ABCDE1234F,Raj Mehta,192,30/06/2026,80000,5000,5000");
    expect(file.rowCount).toBe(3);
    expect(file.fileName).toBe("TDS_24Q_FY2026-27_Q1.csv");
    // Only the two standing assumptions are warned — no missing months, no PAN issues.
    expect(file.warnings).toHaveLength(2);
    expect(file.warnings[0]).toMatch(/Date of payment is assumed/);
    expect(file.warnings[1]).toMatch(/TDS deposited is set equal to TDS deducted/);
  });

  it("appends a per-month quarter summary with totals", () => {
    const file = buildTds24qFile({
      fy: "2026-27",
      quarter: 4,
      months: [month(1, [raj, { ...raj, empCode: "E021", name: "Neha", pan: "PQRST5678K", amountPaid: 50000, tdsDeducted: 0 }]), month(2, [raj])],
    });
    const lines = file.content.split("\r\n");
    const idx = lines.indexOf("Quarter summary — FY 2026-27 Q4");
    expect(idx).toBeGreaterThan(0);
    expect(lines[idx - 1]).toBe(""); // blank separator line
    expect(lines[idx + 1]).toBe("Month,Employees,Amount Paid/Credited,TDS Deducted,TDS Deposited");
    expect(lines[idx + 2]).toBe("Jan 2027,2,130000,5000,5000");
    expect(lines[idx + 3]).toBe("Feb 2027,1,80000,5000,5000");
    expect(lines[idx + 4]).toBe("Total,3,210000,10000,10000");
  });

  it("warns for each month of the quarter without a finalised run", () => {
    const file = buildTds24qFile({ fy: "2026-27", quarter: 4, months: [month(1, [raj]), month(2, [raj])] });
    expect(file.warnings.some((w) => w.startsWith("Mar 2027: no finalised payroll run"))).toBe(true);
    expect(file.rowCount).toBe(2);
  });

  it("files a missing PAN as PANNOTAVBL and warns once per employee", () => {
    const noPan = { ...raj, pan: null };
    const file = buildTds24qFile({ fy: "2026-27", quarter: 1, months: [month(4, [noPan]), month(5, [noPan]), month(6, [noPan])] });
    const lines = file.content.split("\r\n");
    expect(lines[1].startsWith(`${PAN_NOT_AVAILABLE},Raj Mehta,192,`)).toBe(true);
    expect(file.rowCount).toBe(3);
    expect(file.warnings.filter((w) => /PAN missing/.test(w))).toHaveLength(1);
  });

  it("keeps a malformed PAN in the row and warns", () => {
    const file = buildTds24qFile({ fy: "2026-27", quarter: 1, months: [month(4, [{ ...raj, pan: "ABC123" }]), month(5, []), month(6, [])] });
    expect(file.content.split("\r\n")[1].startsWith("ABC123,")).toBe(true);
    expect(file.warnings.some((w) => /PAN "ABC123" is not in the ABCDE1234F format/.test(w))).toBe(true);
  });

  it("uses a supplied date of payment when one is known", () => {
    const file = buildTds24qFile({
      fy: "2026-27",
      quarter: 1,
      months: [
        { month: 4, dateOfPayment: new Date(Date.UTC(2026, 4, 2)), rows: [raj] },
        { month: 5, dateOfPayment: new Date(Date.UTC(2026, 5, 1)), rows: [raj] },
        { month: 6, dateOfPayment: new Date(Date.UTC(2026, 6, 1)), rows: [raj] },
      ],
    });
    expect(file.content.split("\r\n")[1]).toBe("ABCDE1234F,Raj Mehta,192,02/05/2026,80000,5000,5000");
    expect(file.warnings.some((w) => /Date of payment is assumed/.test(w))).toBe(false);
  });

  it("escapes names containing commas", () => {
    const file = buildTds24qFile({ fy: "2026-27", quarter: 1, months: [month(4, [{ ...raj, name: "Mehta, Raj" }]), month(5, []), month(6, [])] });
    expect(file.content.split("\r\n")[1]).toBe('ABCDE1234F,"Mehta, Raj",192,30/04/2026,80000,5000,5000');
  });
});
