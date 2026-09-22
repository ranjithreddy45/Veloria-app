# Veloria Grand - Chunk 12: Invoicing & Payments Knowledge Base

---

## 📌 Module Overview

This directory contains the complete, code-grounded documentation for **Chunk 12: Invoicing & Payments** of the Veloria Grand platform.

### Scope
- **Invoice Master & Line Items**: `prisma.invoice` & `prisma.invoiceLineItem` with sequential numbering (`INV-YYYY-####`).
- **GST & Tax Rules Engine**: Intra-state (CGST 9% + SGST 9%) vs Inter-state (IGST 18%) Place of Supply engine (`src/lib/finance/tax.ts`).
- **Razorpay Payment Gateway**: Order minting, HMAC SHA-256 signature verification, timing-safe webhook processing, and idempotent single-credit capture (`applyRazorpayCapture`).
- **Receipt Allocation & Installments**: Monotonic gapless receipt numbers (`RCP-YYYY-NNNN`) and oldest-due-first installment allocation.
- **General Ledger Accounting Bridge**: Real-time double-entry posting for invoice issuance (Dr AR `1200` / Cr Revenue `4010` & GST) and payment capture (Dr Bank `1010` / Cr AR `1200`).
- **Public & Split Payments**: One-click public checkout (`/pay/[token]`) and multi-payer split payment links (`/pay/split/[token]`).

---

## 📂 Topic Documents Index

1. `01-invoicing-payments-overview.md` - Subsystem architecture & diagram
2. `02-invoicing-business-purpose.md` - Commercial & tax compliance objectives
3. `03-invoice-route-navigation-map.md` - Dashboard, portal, print, and public routes
4. `04-invoice-master.md` - Invoice model schema & fields
5. `05-invoice-numbering.md` - Sequential invoice numbering engine
6. `06-invoice-status-lifecycle.md` - Invoice status enum states & GL triggers
7. `07-invoice-items.md` - Invoice line item schema & fields
8. `08-invoice-calculation-engine.md` - Deterministic 2-decimal money math engine
9. `09-tax-gst.md` - GST tax rules engine & SAC codes
10. `10-payment-overview.md` - Payment capture methods architecture
11. `11-payment-model.md` - Payment model schema & fields
12. `12-payment-status-lifecycle.md` - Payment status states & transitions
13. `13-advance-payments.md` - Deposit minting & slot auto-confirmation
14. `14-razorpay-integration.md` - Razorpay SDK credentials & environment setup
15. `15-razorpay-order-creation.md` - Razorpay order creation flow
16. `16-razorpay-payment-verification.md` - HMAC signature verification logic
17. `17-razorpay-webhooks.md` - Webhook handler route (`/api/payments/webhook`)
18. `18-payment-idempotency.md` - Atomic single-credit capture engine
19. `19-payment-failure-retry.md` - Payment failure recovery & system alert escalation
20. `20-receipts.md` - Monotonic gapless receipt number allocation (`RCP-YYYY-NNNN`)
21. `21-refunds.md` - Refund data fields & GL reversal logic
22. `22-cancellations.md` - Invoice cancellation & receivable reversal
23. `23-accounts-receivable.md` - Accounts Receivable ledger (`1200`)
24. `24-payment-allocation.md` - Installment allocation engine
25. `25-general-ledger-integration.md` - Double-entry General Ledger bridge
26. `26-payment-to-gl.md` - Payment cash receipt GL posting execution
27. `27-invoice-pdf.md` - Printable HTML invoice template rendering
28. `28-receipt-pdf.md` - Printable HTML payment receipt rendering
29. `29-invoice-notifications.md` - Invoice dispatch email & in-app alerts
30. `30-payment-notifications.md` - Instant receipt email & WhatsApp alerts
31. `31-payment-reminders.md` - Overdue cron sweeps & installment reminders
32. `32-invoice-payment-permissions.md` - Granular RBAC permission matrix
33. `33-invoice-payment-database-model.md` - Database ERD & entity relationships
34. `34-invoice-payment-server-actions-api.md` - Complete Server Action & API registry
35. `35-invoice-payment-validation-business-rules.md` - Core business rules & constraints
36. `36-invoice-payment-integrations.md` - System integrations
37. `37-invoice-payment-crons-automation.md` - Scheduled cron jobs
38. `38-invoice-payment-end-to-end-journeys.md` - End-to-end user journeys
39. `39-invoice-payment-dependency-map.md` - Feature dependency matrix
40. `40-invoice-payment-brief-vs-code.md` - Brief vs code traceability matrix
41. `41-invoice-payment-gaps-verification.md` - Codebase verification findings & gaps
42. `42-complete-invoice-payment-feature-index.md` - Feature catalog index (`INV-001` to `PAY-008`)
