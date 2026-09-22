# 29 - Booking Database Model & Relations

---

## 🗄️ Detailed Prisma Schema Mapping

```prisma
// CODE VERIFIED: prisma/schema.prisma
model Booking {
  id                     String           @id @default(cuid())
  bookingNumber          String           @unique
  eventName              String
  eventType              String
  status                 BookingStatus    @default(HOLD)
  date                   DateTime         @db.Date
  timeSlot               TimeSlot
  startTime              DateTime?
  endTime                DateTime?
  guestCount             Int
  specialRequests        String?          @db.Text
  internalNotes          String?          @db.Text
  holdExpiresAt          DateTime?
  guestConfirmationDueAt DateTime?
  guestConfirmedAt       DateTime?
  guestConfirmationToken String?
  guestConfirmedName     String?
  guestTermsVersion      String?
  guestConfirmedIp       String?
  eventStartAt           DateTime?
  totalAmount            Decimal          @db.Decimal(12, 2)
  currency               String           @default("INR")
  hallBooked            String?
  servicesLockedAt      DateTime?
  servicesSummarySentAt DateTime?
  perPlatePrice         Decimal?         @db.Decimal(12, 2)
  hallRental            Decimal?         @db.Decimal(12, 2)
  decorCharges          Decimal?         @db.Decimal(12, 2)
  otherServices         Decimal?         @db.Decimal(12, 2)
  venueGroupId           String?
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt
  venueId                String
  venue                  Venue            @relation(fields: [venueId], references: [id])
  contactId              String
  contact                Contact          @relation(fields: [contactId], references: [id])
  dealId                 String?          @unique
  deal                   Deal?            @relation(fields: [dealId], references: [id])
  createdById            String
  createdBy              User             @relation("BookingCreatedBy", fields: [createdById], references: [id])
  invoices               Invoice[]
  contracts              Contract[]
  operation              EventOperation?
  timeline               EventTimeline?
  bookingMenu            BookingMenu?
  seatingChart           SeatingChart?
  
  @@index([venueId, date, timeSlot])
  @@index([date])
  @@index([status])
  @@index([contactId])
  @@index([eventType])
}
```
