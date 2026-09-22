# 01 - Invoicing & Payments Subsystem Overview

---

## 🏛️ Subsystem Architecture

The Invoicing & Payments module of Veloria Grand handles financial billing, payment capture, tax calculation, payment link generation, Razorpay integration, receipt issuing, and General Ledger (GL) bridge posting.

```
+-----------------------------------------------------------------------------------+
|                              INVOICE & PAYMENT FLOW                               |
+-----------------------------------------------------------------------------------+
|  Booking / Quotation  --->  Invoice (INV-YYYY-####)  --->  Installment Plan      |
|                             (Draft -> Sent -> Paid)         (DueDate allocation)  |
|                                         |                             |           |
|                                         v                             v           |
|                               Razorpay Order / Link          GL Issued Posting    |
|                               (order_id, /pay/[token])       (Dr 1200 / Cr 4010)  |
|                                         |                                         |
|                                         v                                         |
|                               Payment Capture (applyRazorpayCapture)              |
|                               (Atomic status update + Receipt RCP-YYYY-NNNN)      |
|                                         |                                         |
|                                         v                                         |
|                               GL Payment Posting (postPaymentReceived)            |
|                               (Dr 1010/1020 / Cr 1200)                            |
+-----------------------------------------------------------------------------------+
```

---

## 🔑 Key Core Components

| Component | Target File / Model | Primary Purpose | Status |
|---|---|---|---|
| **Invoice Master** | `prisma.invoice` | Billing document header with subtotal, tax, and balance due | `CODE VERIFIED` |
| **Line Items** | `prisma.invoiceLineItem` | Individual service/item lines with quantity, price, and amount | `CODE VERIFIED` |
| **Payment Ledger** | `prisma.payment` | Payment transactions across Razorpay, UPI, Bank Transfer, Cash | `CODE VERIFIED` |
| **Razorpay Integration** | `src/lib/payments/apply-capture.ts` | Order creation, HMAC signature verification, and webhook handler | `CODE VERIFIED` |
| **GST Tax Engine** | `src/lib/finance/tax.ts` | Intra-state (CGST+SGST) vs Inter-state (IGST) tax calculation | `CODE VERIFIED` |
| **Receivables GL Bridge**| `src/lib/finance/receivables.ts` | Double-entry posting for invoice issuance and payment capture | `CODE VERIFIED` |
| **Split Payments** | `prisma.paymentSplit` | Co-host/guest public split payment links for event invoices | `CODE VERIFIED` |
