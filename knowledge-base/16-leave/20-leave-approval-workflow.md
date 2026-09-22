# 20 Leave Approval Workflow Engine

## Approval State Machine

```
[ Apply Leave ] ──► [ Status: PENDING, Balance.pending += days ]
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
  [ Action: APPROVED ]             [ Action: REJECTED ]
   - Status: APPROVED               - Status: REJECTED
   - Balance.pending -= days        - Balance.pending -= days
   - Balance.used += days
```
