# 39 - Kitchen & Inventory Database Models

---

## 🗄️ Detailed Prisma Schema Mapping

```prisma
// CODE VERIFIED: prisma/schema.prisma
model KitchenPlan {
  id              String            @id @default(cuid())
  bookingId       String
  beoId           String?
  covers          Int
  coversSource    String?           // CONTRACTED | RSVP_CONFIRMED | MANUAL
  coversUpdatedAt DateTime?
  status          String            @default("DRAFT") // DRAFT | IN_PROGRESS | COMPLETED
  estFoodCost     Decimal           @db.Decimal(12, 2)
  actualFoodCost  Decimal?          @db.Decimal(12, 2)
  notes           String?           @db.Text
  items           KitchenPlanItem[]
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
}

model KitchenPlanItem {
  id             String      @id @default(cuid())
  planId         String
  plan           KitchenPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  name           String
  category       String?     // STARTER | MAIN | DESSERT | BEVERAGE
  quantity       Decimal     @db.Decimal(10, 2)
  unit           String?     // KG | LTR | PORTION | PCS | PAX
  estUnitCost    Decimal     @db.Decimal(12, 2)
  actualUnitCost Decimal?    @db.Decimal(12, 2)
}

model InventoryItem {
  id           String                 @id @default(cuid())
  name         String
  sku          String?                @unique
  category     String?
  description  String?                @db.Text
  totalQuantity Int                   @default(0)
  availableQty Int                    @default(0)
  reorderLevel Int                    @default(0)
  unitPrice    Decimal?               @db.Decimal(10, 2)
  unit         String?
  location     String?
  reservations InventoryReservation[]
}
```
