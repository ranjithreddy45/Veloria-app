# 13 - Advance Payments & Slot Holding

---

## 🔒 Booking Advance Hold Integration

- **Hold Slot Locking**: Customer date holds (`PublicHold`) require an advance deposit payment.
- **Deposit Minting**: `mintAdvanceInvoice()` generates a deposit invoice for the booking milestone.
- **Slot Confirmation**: `maybeConfirmBookingOnPayment(invoiceId)` automatically converts a `HOLD` booking to `CONFIRMED` as soon as the advance deposit payment is captured.
