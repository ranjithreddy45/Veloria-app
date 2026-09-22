# 25 - General Ledger Integration

---

## 📑 Financial Accounting Bridge

All invoice and payment state changes synchronize directly with the General Ledger (`FinJournalEntry` & `FinJournalLine`):

```
Invoice Issued:
  Debit:  Accounts Receivable (1200)    [ totalAmount ]
    Credit: Event Sales Revenue (4010)   [ afterDiscount ]
    Credit: CGST Payable (2210)          [ cgstAmount ]
    Credit: SGST Payable (2220)          [ sgstAmount ]
    Credit: IGST Payable (2230)          [ igstAmount ]

Payment Captured:
  Debit:  Bank / Cash Account (1010/1020) [ amount ]
    Credit: Accounts Receivable (1200)    [ amount ]
```
