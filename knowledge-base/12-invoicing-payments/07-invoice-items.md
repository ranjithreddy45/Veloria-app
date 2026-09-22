# 07 - Invoice Line Items

---

## 📦 Line Item Schema (`prisma.invoiceLineItem`)

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique item ID |
| `invoiceId` | `String` | `@relation(Invoice)` | Parent invoice reference |
| `description` | `String` | Required | Line description (e.g., "Hall Rental - Sapphire Ballroom") |
| `quantity` | `Decimal` | `@db.Decimal(10, 2)` | Quantity billed |
| `unitPrice` | `Decimal` | `@db.Decimal(12, 2)` | Price per unit |
| `amount` | `Decimal` | `@db.Decimal(12, 2)` | Subtotal (`quantity * unitPrice`) |
| `sacCode` | `String?` | Optional | HSN/SAC code per line |
| `order` | `Int` | `@default(0)` | Line item display order |
