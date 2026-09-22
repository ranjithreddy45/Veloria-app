# 26 - Kitchen & Catering Service Operations

---

## 🍳 Kitchen Batch Planning (`KitchenPlan` & `KitchenPlanItem`)

```prisma
// CODE VERIFIED: prisma/schema.prisma
model KitchenPlan {
  id              String            @id @default(cuid())
  bookingId       String
  beoId           String
  covers          Int
  coversSource    String?           // CONTRACTED | RSVP_CONFIRMED | MANUAL
  status          String            @default("DRAFT")
  estFoodCost     Decimal           @db.Decimal(12, 2)
  actualFoodCost  Decimal?          @db.Decimal(12, 2)
  items           KitchenPlanItem[]
}
```

- **Server Actions**: `src/actions/kitchen.actions.ts` (`createKitchenPlan`, `addPlanItem`, `updateKitchenPlan`).
- **Cost Margin Control**: Tracks `estFoodCost` vs `actualFoodCost` to evaluate kitchen efficiency and food wastage metrics.
