# 05 Data Model & Schema Specifications

`CODE VERIFIED`

## Core Data Schema

```prisma
model HrReimbursementClaim {
  id           String    @id @default(cuid())
  entityId     String    @default("BILLION")
  employeeId   String
  category     String    // TRAVEL | MEDICAL | TELEPHONE | FUEL | BOOKS | OTHER
  title        String
  amount       Decimal   @db.Decimal(18, 2)
  fuelLiters   Decimal?  @db.Decimal(10, 2)
  taxable      Boolean   @default(false)
  claimDate    DateTime  @db.Date
  billUrl      String?   @db.Text
  note         String?
  status       String    @default("PENDING") // PENDING | PENDING_L2 | NEEDS_INFO | APPROVED | REJECTED | PAID | WITHDRAWN
  decidedById  String?
  decidedAt    DateTime?
  decisionNote String?
  
  level1ById   String?
  level1At     DateTime?
  level1Note   String?
  level2ById   String?
  level2At     DateTime?
  level2Note   String?
  level3ById   String?
  level3At     DateTime?
  level3Note   String?

  paymentRef   String?
  payFy        String?
  payMonth     Int?
  runId        String?
  paidAt       DateTime?
  createdById  String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  attachments HrClaimAttachment[]
  events      HrClaimEvent[]
}

model HrClaimAttachment {
  id           String               @id @default(cuid())
  claimId      String
  claim        HrReimbursementClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)
  fileName     String
  mimeType     String               // image/jpeg | image/png | image/webp | application/pdf
  sizeBytes    Int                  @default(0)
  data         String               @db.Text
  uploadedById String?
  createdAt    DateTime             @default(now())
}

model HrReimbursementApprover {
  id        String   @id @default(cuid())
  level     Int      // 1 or 2
  scope     String   @default("ALL") // ALL | CATEGORY_EVENT | departmentId
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([level, scope])
}

model HrClaimEvent {
  id         String               @id @default(cuid())
  claimId    String
  claim      HrReimbursementClaim @relation(fields: [claimId], references: [id], onDelete: Cascade)
  action     String               // SUBMITTED | INFO_REQUESTED | RESUBMITTED | EDITED | APPROVED | REJECTED | PAID | WITHDRAWN
  fromStatus String?
  toStatus   String?
  note       String?              @db.Text
  actorId    String?
  actorName  String?
  createdAt  DateTime             @default(now())
}
```
