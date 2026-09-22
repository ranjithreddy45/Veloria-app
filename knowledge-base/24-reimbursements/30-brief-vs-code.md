# 30 Project Brief vs. Code Discrepancy Matrix

`CODE VERIFIED`

## Forensic Discrepancy Comparison

| Requirement Claim | Brief Specification | Actual Code Implementation | Status / Gap |
| :--- | :--- | :--- | :--- |
| **50L Monthly Fuel Cap** | 50 liters limit per employee per month | Implemented in `submitReimbursement()` via aggregate check | `MATCH` |
| **Approval Levels** | L1 Manager, L2 HR, L3 Finance | Implemented via `HrReimbursementApprover` rules (L1, L2, L3) | `MATCH` |
| **Bill Attachments** | Approvers must view attached bills | Implemented via `getClaimAttachment()` & browser modal preview | `MATCH` |
