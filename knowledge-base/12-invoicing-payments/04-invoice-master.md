# 04 - Invoice Master Model

---

## 📋 Invoice Model (`prisma.invoice`)

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique invoice ID |
| `invoiceNumber` | `String` | `@unique` | Sequential identifier (`INV-YYYY-####`) |
| `contactId` | `String` | `@relation(Contact)` | Linked customer contact |
| `bookingId` | `String?` | Optional | Linked event booking |
| `issueDate` | `DateTime` | Required | Invoice issue date |
| `dueDate` | `DateTime` | Required | Payment due date |
| `subtotal` | `Decimal` | `@db.Decimal(12, 2)` | Sum of line item amounts |
| `discountPercent` | `Decimal` | `@default(0)` | Overall discount percentage |
| `discountAmount` | `Decimal` | `@default(0)` | Computed discount in INR |
| `cgstRate` | `Decimal` | `@default(9)` | CGST rate percentage |
| `sgstRate` | `Decimal` | `@default(9)` | SGST rate percentage |
| `igstRate` | `Decimal` | `@default(0)` | IGST rate percentage |
| `cgstAmount` | `Decimal` | `@default(0)` | Computed CGST amount |
| `sgstAmount` | `Decimal` | `@default(0)` | Computed SGST amount |
| `igstAmount` | `Decimal` | `@default(0)` | Computed IGST amount |
| `totalAmount` | `Decimal` | `@db.Decimal(12, 2)` | Net invoice total inclusive of tax |
| `paidAmount` | `Decimal` | `@default(0)` | Cumulative settled amount |
| `balanceDue` | `Decimal` | `@db.Decimal(12, 2)` | Remaining balance owed |
| `status` | `InvoiceStatus` | `@default(DRAFT)` | `DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`, `REFUNDED` |
| `gstin` | `String?` | Optional | Customer GSTIN |
| `placeOfSupply` | `String?` | Optional | State name / State code |
| `sacCode` | `String?` | `@default("996332")` | HSN/SAC code for banquet services |
