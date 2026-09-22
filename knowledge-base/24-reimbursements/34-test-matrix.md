# 34 Quality Assurance & Security Test Suite

`CODE VERIFIED`

## QA Test Specifications

| Test ID | Scenario | Precondition | Expected Outcome | Priority |
| :--- | :--- | :--- | :--- | :--- |
| `TST-REIM-01` | Submit fuel claim > 50L | Current sum = 40L, new claim = 15L | Error: "Monthly fuel limit of 50 liters exceeded" | `CRITICAL` |
| `TST-REIM-02` | Approve Level 1 claim | User is L1 approver | Claim status updates to `PENDING_L2` | `HIGH` |
