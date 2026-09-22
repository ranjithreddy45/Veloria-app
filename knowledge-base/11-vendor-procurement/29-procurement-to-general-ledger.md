# 29 - Procurement to General Ledger

---

## 📑 Automated GL Accrual Bridge (`postPurchaseReceivedWithinTx`)

When a Purchase Requisition is marked `RECEIVED`, `postPurchaseReceivedWithinTx` automatically posts a General Ledger entry:

```
Debit:  Supplies & Consumables (5230)      [ totalAmount ]
  Credit: Accounts Payable / Creditors (2010) [ totalAmount ]
```

---

## 🔒 Idempotency & Resiliency

- **Idempotency**: Entries are tagged with `sourceModule = "PAYABLE"` and `sourceRefId = "PR:<prId>"`. Re-running the bridge returns `{ posted: false, reason: "already-posted" }`.
- **Self-Seeding**: Automatically seeds account `5230` in the Chart of Accounts if it does not already exist.
