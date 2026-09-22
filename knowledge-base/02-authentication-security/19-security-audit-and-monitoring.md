# CHUNK 02-19 — SECURITY AUDIT & MONITORING

- **Status**: `CODE VERIFIED`
- **Module**: Authentication & Security
- **Target Path**: `knowledge-base/02-authentication-security/19-security-audit-and-monitoring.md`

---

## 📜 Audit Trail Logging

Security-relevant actions generate permanent audit records in the database:

1. **`ActivityLog` Model**: Logs administrative actions (user role changes, contract cancellations, pricing rule updates) with `userId`, `action`, `ipAddress`, and `metadata`.
2. **`ApprovalLog` Model**: Logs reimbursement, leave, and payout approval cascades with approver `userId`, timestamp, and approval stage (`L1`, `L2`, `FINANCE`).
