# 19 - Booking Confirmation Mechanics

---

## ✅ Confirmation Criteria

A booking achieves full `CONFIRMED` status through one of three pathways:
1. **Direct Admin Action**: Sales Head / Admin invokes `confirmBooking(bookingId)` after receiving manual offline payment or wire transfer.
2. **Contract Signature**: Client signs legal contract via `/sign/[token]`, triggering automatic promotion.
3. **Deposit Payment Capture**: Webhook or payment action processes initial deposit invoice (`Invoice.status == 'PAID'`), promoting the booking to `CONFIRMED`.
