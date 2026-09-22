# 13 Salary Structure Builder & Components

## Structure Resolver (`buildStructureLines` in `payroll-calc.ts`)

Resolves CTC into component lines:
1. `BASIC`: Defined as `basicPct` (default 50%) of monthly CTC.
2. `FLAT` / `PCT_OF_BASIC` / `PCT_OF_CTC` allowances.
3. `BALANCE`: Special Allowance absorbs remaining CTC balance.
