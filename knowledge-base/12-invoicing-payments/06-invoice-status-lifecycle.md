# 06 - Invoice Status Lifecycle

---

## 🔄 Invoice Status Enum (`InvoiceStatus`)

```
+-------+   sendInvoice()   +------+   Partial Pay   +----------------+
| DRAFT | ----------------> | SENT | --------------> | PARTIALLY_PAID |
+-------+                   +------+                 +----------------+
                               |                            |
                               | Due Date Passed            | Full Pay
                               v                            v
                         +---------+                  +------------+
                         | OVERDUE | ---------------> |    PAID    |
                         +---------+   Full Pay       +------------+
```

| Status | Meaning | GL Posting Trigger |
|---|---|---|
| `DRAFT` | Editable draft invoice | None |
| `SENT` | Formally issued to customer | Debit AR (`1200`), Credit Sales (`4010`) & Tax |
| `PARTIALLY_PAID` | Partial payment received (`balanceDue > 0`) | Cash Receipt posted for paid portion |
| `PAID` | Fully settled (`balanceDue <= 0.01`) | Final Cash Receipt posted |
| `OVERDUE` | Unsettled past `dueDate` | Flagged by `markOverdue()` cron |
| `CANCELLED` | Voided invoice | Triggers `reverseReceivableEntry()` in GL |
