# 11 - Payment Model

---

## 📋 Payment Model (`prisma.payment`)

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique payment ID |
| `invoiceId` | `String` | `@relation(Invoice)` | Target invoice link |
| `amount` | `Decimal` | `@db.Decimal(12, 2)` | Amount paid in INR |
| `status` | `PaymentStatus` | `@default(PENDING)` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`, `CANCELLED` |
| `method` | `PaymentMethod` | `@default(RAZORPAY)` | `RAZORPAY`, `BANK_TRANSFER`, `CASH`, `CHEQUE`, `UPI` |
| `transactionId` | `String?` | `@unique` | Gateway transaction / UTR ID |
| `razorpayOrderId` | `String?` | Optional | Razorpay order reference |
| `razorpaySignature` | `String?` | Optional | HMAC signature string |
| `receiptNumber` | `String?` | Optional | Gapless receipt number (`RCP-YYYY-NNNN`) |
| `receiptUrl` | `String?` | Optional | Uploaded bank receipt proof link |
| `paidAt` | `DateTime?` | Optional | Payment completion timestamp |
| `refundedAt` | `DateTime?` | Optional | Refund completion timestamp |
| `refundReason` | `String?` | Optional | Note describing refund cause |
