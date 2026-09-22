# 10 Employee Payroll Eligibility Rules

## Eligibility Criteria

`computePayrollRun` includes active employees (`status == "ACTIVE"`, `deletedAt == null`) who possess a valid `HrSalaryStructure`. Mid-year joiners are evaluated using joining date parameters.
