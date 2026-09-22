# 23 - Accounts Receivable

---

## 📊 Receivables Ledger (`src/lib/finance/receivables.ts`)

Accounts Receivable is tracked under Chart of Accounts code `1200`:
- **Invoice Issued**: `postInvoiceIssued()` -> Dr Accounts Receivable (`1200`) / Cr Revenue (`4010`) & GST (`2210`/`2220`/`2230`).
- **Payment Received**: `postPaymentReceived()` -> Dr Bank (`1010`) / Cr Accounts Receivable (`1200`).
- **Outstanding Balance**: Computed dynamically as `totalAmount - paidAmount`.
