# 36 Recruitment -> Employee Creation

`CODE VERIFIED`

Executed by `createEmployeeFromCandidate(candidateId)` in `src/actions/recruit-hire.actions.ts`:
1. **HIRED Gate**: Candidate must have `stage = HIRED`, a `HIRED` application, or an `ACCEPTED` offer.
2. **Idempotency**: Checks existing employee by `workEmail`/`personalEmail` or `notes` containing `recruitment candidate ${candidateId}`.
3. **Legal Entity**: Maps `candidate.entityId` to `LegalEntity.shortCode` or takes first active `LegalEntity`.
4. **Dept/Designation**: Case-insensitive lookup of `job.department` and `job.postingTitle` against `Department` and `HrDesignation`.
5. **Employee Create**: Calls `createEmployee()` from `src/actions/hr-employee.actions.ts`.
6. **Notes**: Appends `Created from recruitment candidate ${candidateId}. Offered CTC: ${ctc}` to `Employee.notes`.
7. **Onboarding**: Calls `startOnboarding(employeeId, joiningDate)`.
