# 34 - BEO & Operations Database Models

---

## 🗄️ Detailed Prisma Schema Mapping

```prisma
// CODE VERIFIED: prisma/schema.prisma
model Beo {
  id              String        @id @default(cuid())
  beoNumber       String        @unique
  bookingId       String
  status          String        @default("DRAFT") // DRAFT | PUBLISHED | LOCKED
  covers          Int?
  coversSource    String?       // CONTRACTED | RSVP_CONFIRMED | MANUAL
  coversUpdatedAt DateTime?
  runOfShow       Json?
  incidents       BeoIncident[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model BeoIncident {
  id           String   @id @default(cuid())
  beoId        String
  beo          Beo      @relation(fields: [beoId], references: [id], onDelete: Cascade)
  title        String
  description  String?  @db.Text
  severity     String   @default("LOW") // LOW | MEDIUM | HIGH
  status       String   @default("OPEN") // OPEN | RESOLVED
  photoUrl     String?
  reportedById String
  createdAt    DateTime @default(now())
}

model KitchenPlan {
  id             String            @id @default(cuid())
  bookingId      String
  beoId          String
  covers         Int
  coversSource   String?
  status         String            @default("DRAFT")
  estFoodCost    Decimal           @db.Decimal(12, 2)
  actualFoodCost Decimal?          @db.Decimal(12, 2)
  items          KitchenPlanItem[]
}
```
