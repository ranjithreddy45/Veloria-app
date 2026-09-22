# 62 Recruitment Handoff Matrix

`CODE VERIFIED`

| Candidate / Offer Data | Employee Central Destination | Handoff Type | Responsible Function / Action |
|---|---|---|---|
| Candidate Name | `Employee.firstName`, `lastName` | `AUTOMATIC` | `createEmployeeFromCandidate` / `splitName` |
| Candidate Email | `Employee.workEmail` | `AUTOMATIC` | `createEmployeeFromCandidate` |
| Candidate Phone | `Employee.phone` | `AUTOMATIC` | `createEmployeeFromCandidate` |
| Candidate Entity ID | `Employee.legalEntityId` | `AUTOMATIC` | `createEmployeeFromCandidate` |
| Job Department | `Employee.departmentId` | `AUTOMATIC` (Name match) | `createEmployeeFromCandidate` |
| Job Title | `Employee.designationId` | `AUTOMATIC` (Name match) | `createEmployeeFromCandidate` |
| Offer Joining Date | `Employee.dateOfJoining` | `AUTOMATIC` | `createEmployeeFromCandidate` |
| Offer CTC | `Employee.notes` (Text) | `AUTOMATIC` (Info only) | `createEmployeeFromCandidate` |
| User Account | `User` Model | `MANUAL` | Separate HR Provisioning |
| Reporting Manager | `Employee.reportingManagerId` | `MANUAL` | Separate HR Update |
| Salary Breakdown | `HrSalaryStructure` Model | `MANUAL` | Separate Payroll Setup |
| Statutory Data | `EmployeeStatutory` Model | `MANUAL` | Separate Onboarding Entry |
| Onboarding Journey | `OnboardingJourney` Model | `AUTOMATIC` | `startOnboarding()` |
