# 06 Payroll Database Models & Schema

## Core Schema Models (`prisma/schema.prisma`)

### 1. `HrPayrollRun`
- `id`, `entityId`, `fy`, `month`, `label`, `status` (`DRAFT`, `LOCKED`, `PAID`), `totalGross`, `totalDeductions`, `totalNet`, `headcount`, `journalEntryId`, `glPostedAt`.
- Unique constraint: `@@unique([entityId, fy, month])`.

---

### 2. `HrPayslip`
- `id`, `runId`, `employeeId`, `empCodeSnap`, `nameSnap`, `paidDays`, `lopDays`, `gross`, `earnings` (JSON), `deductions` (JSON), `advanceRecovered`, `pf`, `esi`, `pt`, `tds`, `net`, `ctc`.
- Unique constraint: `@@unique([runId, employeeId])`.

---

### 3. `HrSalaryStructure`
- `id`, `employeeId`, `effectiveFrom`, `annualCtc`, `monthlyCtc`, `basicPct`, `lines` (JSON snapshot).
