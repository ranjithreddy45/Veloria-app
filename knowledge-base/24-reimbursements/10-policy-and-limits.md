# 10 Claim Limits & Policy Engine

`CODE VERIFIED`

## Policy Enforcement Matrix

| Policy Rule | Limit Value | Enforcement Location | Bypass / Override | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Monthly Fuel Cap** | 50 Liters / Month | `submitReimbursement()` | None | `IMPLEMENTED` |
| **Attachment Size Cap** | 10 MB per claim | `addClaimAttachments()` | None | `IMPLEMENTED` |
| **Allowed File Types** | JPEG, PNG, WEBP, PDF | `addClaimAttachments()` | None | `IMPLEMENTED` |
| **Edit Restrictions** | Only `PENDING`/`NEEDS_INFO` | `addClaimAttachments()` | HR Manager Override | `IMPLEMENTED` |
