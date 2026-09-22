# 23 - Booking to Payments & Razorpay Integration

---

## 💳 Payment Settlement Architecture

- **Payment Processing**: Integrated via `src/actions/payment.actions.ts` and Razorpay payment gateway webhooks.
- **Client Payment Gateway**: Clients pay deposit invoices directly through `/portal/bookings/[bookingId]` or guest receipt link `/api/guest/receipt/[paymentId]`.
- **Ledger Recording**: Successful payment transactions update `Invoice.paidAmount`, recalculate balance due, and post entries to General Ledger accounts.
