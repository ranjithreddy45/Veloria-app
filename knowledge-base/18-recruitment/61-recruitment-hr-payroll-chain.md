# 61 Recruitment -> HR -> Payroll Chain

`CODE VERIFIED`

```
Candidate (HIRED / ACCEPTED Offer)
  |
  +---> createEmployeeFromCandidate()
           |
           +---> Employee (status: ONBOARDING)
           +---> Notes: "Offered CTC: 800000"
           +---> startOnboarding()
           |
           v [MANUAL HR STEPS]
           +---> Create User Account (Login)
           +---> Assign Reporting Manager
           +---> Create HrSalaryStructure (Basic, HRA)
           +---> Populate EmployeeStatutory (PAN, Bank)
           |
           v
       Payroll Execution (Chunk 17)
```
