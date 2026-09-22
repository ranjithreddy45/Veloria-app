# 24 Portal Prisma Data Models

`CODE VERIFIED`

## Core Data Schema Supporting Portals

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String?
  role         UserRole  @default(CLIENT)
  vendorId     String?
  vendor       Vendor?   @relation(fields: [vendorId], references: [id])
  createdAt    DateTime  @default(now())
}

model Contact {
  id          String    @id @default(cuid())
  name        String
  email       String    @unique
  phone       String
  bookings    Booking[]
  invoices    Invoice[]
  contracts   Contract[]
}

model Vendor {
  id           String        @id @default(cuid())
  name         String
  contactEmail String
  phone        String
  userId       String?       @unique
  user         User?
  workOrders   WorkOrder[]
  bids         VendorBid[]
  bills        VendorBill[]
}

model QuoteShareLink {
  id        String   @id @default(cuid())
  quoteId   String
  token     String   @unique
  expiresAt DateTime
  isRevoked Boolean  @default(false)
  viewCount Int      @default(0)
}

model SignatureRequest {
  id           String    @id @default(cuid())
  contractId   String
  token        String    @unique
  signerName   String
  signerEmail  String
  signedAt     DateTime?
  ipAddress    String?
  signatureUrl String?
  expiresAt    DateTime
}

model PublicHold {
  id         String   @id @default(cuid())
  venueId    String
  holdDate   DateTime
  token      String   @unique
  holdFee    Float
  expiresAt  DateTime
  isReleased Boolean  @default(false)
}
```
