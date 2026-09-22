# 18 - Vendor Work Order Acceptance & Decline

---

## 📩 Response Channels

Vendors can accept or decline work orders through two channels:
1. **Logged-in Vendor Portal**: `respondToMyAssignment(assignmentId, "CONFIRM" | "DECLINE")`.
2. **Public Token Confirmation**: `/vendor-confirm/[token]` powered by `public-vendor-confirm.actions.ts` for vendors without portal logins.

---

## ❌ Decline Audit Trail

Declining a work order requires a mandatory decline reason string (`declineReason`), logged in the system activity audit log.
