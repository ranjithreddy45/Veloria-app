# 42 - Complete Invoicing & Payment Feature Index

---

## 🆔 Granular Feature Index

| Feature ID | Feature Name | Source File | Status |
|---|---|---|---|
| `INV-001` | Sequential Invoice Numbering | `src/actions/invoice.actions.ts` | `CODE VERIFIED` |
| `INV-002` | Deterministic Money Rounding Engine | `src/lib/invoice-calc.ts` | `CODE VERIFIED` |
| `INV-003` | GST Place of Supply Engine | `src/lib/finance/tax.ts` | `CODE VERIFIED` |
| `INV-004` | Invoice Issue GL Posting | `src/lib/finance/receivables.ts` | `CODE VERIFIED` |
| `PAY-001` | Razorpay Order Minting | `src/app/api/payments/create-order/route.ts` | `CODE VERIFIED` |
| `PAY-002` | Razorpay HMAC Verification | `src/app/api/payments/verify/route.ts` | `CODE VERIFIED` |
| `PAY-003` | Idempotent Capture Engine | `src/lib/payments/apply-capture.ts` | `CODE VERIFIED` |
| `PAY-004` | Monotonic Receipt Number Allocation | `src/lib/finance/receipt-number.ts` | `CODE VERIFIED` |
| `PAY-005` | Installment Paid Allocation | `src/lib/payments/apply-capture.ts` | `CODE VERIFIED` |
| `PAY-006` | Payment Receipt GL Posting | `src/lib/finance/receivables.ts` | `CODE VERIFIED` |
| `PAY-007` | Public Multi-Payer Split Link | `src/lib/payments/split-payments.ts` | `CODE VERIFIED` |
| `PAY-008` | Booking Auto-Confirmation on Payment | `src/lib/sales/confirm-booking.ts` | `CODE VERIFIED` |
