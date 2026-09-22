# 14 Employee Offboarding & Exit Management

## Exit Management (`hr-fnf.actions.ts`)

- Triggered when employee status changes to `EXITED` and `dateOfExit` is set.
- Calculates Full & Final (F&F) settlement (`HrFnfSettlement`).
- Settles encashable leaves, gratuity, pending reimbursements, and notice pay.
- Deactivates linked `User` account.
