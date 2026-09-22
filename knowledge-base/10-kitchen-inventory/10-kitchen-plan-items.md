# 10 - Kitchen Plan Items Specification

---

## 📦 `KitchenPlanItem` Data Model

```prisma
// CODE VERIFIED: prisma/schema.prisma
model KitchenPlanItem {
  id             String      @id @default(cuid())
  planId         String
  plan           KitchenPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  name           String
  category       String?     // STARTER | MAIN | DESSERT | BEVERAGE | LIVE_STATION
  quantity       Decimal     @db.Decimal(10, 2)
  unit           String?     // KG | LTR | PORTION | PCS | PAX
  estUnitCost    Decimal     @db.Decimal(12, 2)
  actualUnitCost Decimal?    @db.Decimal(12, 2)
}
```

- **Decimal Safety**: All quantities and unit costs use Prisma `Decimal(12, 2)` to prevent floating point rounding drift.
