# 29 - Purchase Requisition (PR) Management

---

## 📋 Requisition Architecture (`PurchaseRequisition`)

```prisma
// CODE VERIFIED: prisma/schema.prisma
model PurchaseRequisition {
  id            String                     @id @default(cuid())
  prNumber      String                     @unique // Sequential e.g. PR-2026-0012
  title         String
  status        String                     @default("PENDING") // PENDING | APPROVED | REJECTED | ORDERED | RECEIVED
  bookingId     String?
  vendorId      String?
  department    String?
  neededBy      DateTime?
  totalAmount   Decimal                    @db.Decimal(12, 2)
  items         PurchaseRequisitionItem[]
}
```

- **Server Actions**: `src/actions/procurement.actions.ts` (`createPurchaseRequisition`, `approvePR`, `rejectPR`, `markOrdered`, `markReceived`).
