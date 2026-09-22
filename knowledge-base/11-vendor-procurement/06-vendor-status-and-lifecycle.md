# 06 - Vendor Status & Lifecycle

---

## 🔄 Status Enum States (`VendorStatus`)

```
+-------------------+      Approve      +--------+
| PENDING_APPROVAL  | ----------------> | ACTIVE |
+-------------------+                   +--------+
          |                                 |
          | Deactivate                      | Deactivate / Blacklist
          v                                 v
    +----------+                    +-------------+
    | INACTIVE | <----------------- | BLACKLISTED |
    +----------+                    +-------------+
```

| Status | Meaning | Operational Access |
|---|---|---|
| `PENDING_APPROVAL` | Freshly registered vendor requiring manager review | Read-only; cannot be assigned to bookings |
| `ACTIVE` | Verified vendor in good standing | Full bidding, assignment, and payout privileges |
| `INACTIVE` | Temporarily disabled vendor | Excluded from active assignment pickers |
| `BLACKLISTED` | Permanently blocked due to SLA/compliance breach | Forbidden from bidding or receiving work orders |
