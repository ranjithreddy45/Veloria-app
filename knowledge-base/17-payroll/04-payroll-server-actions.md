# 04 Payroll Server Actions Inventory

## Core Action Files (`src/actions/`)

- `hr-payroll-run.actions.ts`: `listPayrollRuns`, `createPayrollRun`, `computePayrollRun`, `lockPayrollRun`, `markPayrollPaid`.
- `finance-payroll.actions.ts`: `createPayrollRun`, `postPayrollRun` (Posts balanced GL journal entry).
- `hr-compensation.actions.ts`: `saveSalaryStructure`, `getSalaryStructure`.
- `hr-advance.actions.ts`: `createAdvance`, `getAdvances`.
- `hr-arrear.actions.ts`: `createArrear`, `getArrears`.
- `hr-fnf.actions.ts`: `calculateFnfSettlement`, `saveFnfSettlement`.
