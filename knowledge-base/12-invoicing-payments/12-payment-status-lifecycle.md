# 12 - Payment Status Lifecycle

---

## 🔄 Payment Status Enum (`PaymentStatus`)

```
               +---------+
               | PENDING |
               +---------+
                 /     \
   Capture      /       \   Fail / Timeout
               v         v
        +-----------+   +--------+
        | COMPLETED |   | FAILED |
        +-----------+   +--------+
              |
              | Refund
              v
        +----------+
        | REFUNDED |
        +----------+
```

| Status | Meaning | GL Side Effect |
|---|---|---|
| `PENDING` | Payment initialized / link generated | None |
| `COMPLETED` | Verified capture or staff approval | Debit Bank (`1010`) / Credit AR (`1200`) |
| `FAILED` | Gateway decline or webhook failure | Marked by webhook or cron sweep |
| `REFUNDED` | Returned to customer | Debit AR (`1200`) / Credit Bank (`1010`) |
