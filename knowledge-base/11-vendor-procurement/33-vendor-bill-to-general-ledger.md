# 33 - Vendor Bill to General Ledger

---

## 📑 Accrual Journal Entry Posting

Approving a `VendorBill` creates an atomic General Ledger accrual entry inside `$transaction`:

```
Debit:  Event Expense Account (5010 / 5020 / 5030 / 5040 / 5230)  [ bill.amount ]
  Credit: Accounts Payable (2100)                                   [ bill.amount ]
```

---

## 🔄 Vendor Advance Netting

Immediately following approval, `netAdvancesAgainstBill()` automatically nets any paid vendor advances (sitting in asset account `1300`) against the bill balance, reducing the payable amount.
