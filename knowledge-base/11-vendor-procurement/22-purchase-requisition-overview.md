# 22 - Purchase Requisition Overview

---

## 🛒 Purchase Requisition Model (`prisma.purchaseRequisition`)

A `PurchaseRequisition` represents a formal venue supply or kitchen purchase request:

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique PR ID |
| `prNumber` | `String` | `@unique` | Sequential allocation (e.g., `PR-2026-001`) |
| `title` | `String` | Required | Purchase request title |
| `status` | `String` | `@default("PENDING")` | `PENDING`, `APPROVED`, `ORDERED`, `RECEIVED`, `REJECTED` |
| `totalAmount` | `Decimal` | `@db.Decimal(12, 2)` | Sum of item costs |
| `requestedById` | `String` | Required | User ID of requester |
| `approvedById` | `String?` | Optional | User ID of approver |
| `approvedAt` | `DateTime?` | Optional | Timestamp of approval |
| `orderedAt` | `DateTime?` | Optional | Timestamp of order placement |
| `receivedAt` | `DateTime?` | Optional | Timestamp of goods receipt |
