# 24 - Purchase Requisition Items

---

## 📦 PR Line Items (`prisma.purchaseRequisitionItem`)

Line items are created atomically alongside the header in `createPurchaseRequisition()`:

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique item ID |
| `prId` | `String` | `@relation(PurchaseRequisition)` | Parent requisition link |
| `name` | `String` | Required | Item description / SKU name |
| `quantity` | `Decimal` | `@db.Decimal(12, 2)` | Quantity requested |
| `unit` | `String?` | Optional | Unit of measure (e.g., "kg", "boxes") |
| `unitPrice` | `Decimal` | `@db.Decimal(12, 2)` | Unit price |
| `received` | `Boolean` | `@default(false)` | Marked `true` upon goods receipt |
