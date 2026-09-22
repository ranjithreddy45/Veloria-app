# 06 Enums & State Machine Specifications

`CODE VERIFIED`

## Claim Lifecycle State Machine

```mermaid
flowchart TD
    DRAFT[DRAFT] --> SUBMITTED[PENDING - Level 1 Approval]
    SUBMITTED --> PENDING_L2[PENDING_L2 - Level 2 Approval]
    SUBMITTED --> REJECTED[REJECTED]
    SUBMITTED --> NEEDS_INFO[NEEDS_INFO]
    SUBMITTED --> WITHDRAWN[WITHDRAWN]
    
    PENDING_L2 --> APPROVED[APPROVED - Pending Payment]
    PENDING_L2 --> REJECTED
    PENDING_L2 --> NEEDS_INFO
    
    NEEDS_INFO --> RESUBMITTED[PENDING - Resubmitted]
    RESUBMITTED --> PENDING_L2
    
    APPROVED --> PAID_DIRECT[PAID - Direct Finance Payout]
    APPROVED --> PAID_PAYROLL[PAID - Scheduled on Payroll Run]
```

### State Transition Rules
1. **`PENDING`**: Awaiting Level 1 approval.
2. **`PENDING_L2`**: Level 1 approved; awaiting Level 2 (Department/HR) approval.
3. **`APPROVED`**: Level 1 & Level 2 approved. Claim is now visible to Finance and HR Payroll.
4. **`PAID`**: Terminal settlement state reached either via direct payment (`markReimbursementPaid`) or payroll run posting (`runId`).
