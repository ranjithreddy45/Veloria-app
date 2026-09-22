# 18 - Payment Idempotency

---

## 🛡️ Double-Credit Prevention

Because both the browser verify call AND the Razorpay server webhook fire for the same payment, `applyRazorpayCapture()` enforces atomic single-execution:

```typescript
const flip = await tx.payment.updateMany({
  where: { id: payment.id, status: { not: "COMPLETED" } },
  data: { status: "COMPLETED", paidAt: new Date(), ... }
});

if (flip.count !== 1) {
  return { ok: true, invoiceId: payment.invoiceId, alreadyProcessed: true };
}
```
If `flip.count === 0`, the transaction aborts incrementing `paidAmount`, guaranteeing money is credited **EXACTLY ONCE**.
