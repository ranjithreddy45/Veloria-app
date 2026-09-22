# 18 Cancellation & Reversal Accounting

## Invoice Cancellation Flow

When an issued invoice is cancelled (`reverseInvoiceEntry` in `src/actions/invoice-cancel.actions.ts` and `src/lib/finance/receivables.ts`), the system posts an exact counter-reversal entry.

---

## Reversal Journal Entry Structure

| Account Name | Code | Account Type | Debit | Credit |
| :--- | :--- | :--- | :--- | :--- |
| **Event Sales Revenue** | `4010` | `REVENUE` | **Subtotal (Net)** | - |
| **CGST Payable** | `2210` | `LIABILITY` | **CGST Amount** | - |
| **SGST Payable** | `2220` | `LIABILITY` | **SGST Amount** | - |
| **IGST Payable** | `2230` | `LIABILITY` | **IGST Amount** | - |
| **Accounts Receivable** | `1200` | `ASSET` | - | **Total Invoice Amount** |
