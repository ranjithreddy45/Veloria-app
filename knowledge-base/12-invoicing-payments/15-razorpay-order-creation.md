# 15 - Razorpay Order Creation

---

## 🛒 Order Creation Flow (`createRazorpayOrder`)

1. **Request**: Invoked via API `/api/payments/create-order` or action `createRazorpayOrder(invoiceId, amount)`.
2. **Order Minting**:
```typescript
const order = await razorpay.orders.create({
  amount: toPaise(amount),
  currency: "INR",
  receipt: invoice.invoiceNumber,
  notes: { invoiceId: invoice.id }
});
```
3. **Database Ledger**: Creates a `Payment` record in `PENDING` status storing `razorpayOrderId`.
