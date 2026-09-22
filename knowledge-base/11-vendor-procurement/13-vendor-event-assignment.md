# 13 - Vendor Event Assignment

---

## 📌 Booking Vendor Line (`prisma.bookingVendor`)

The `BookingVendor` junction table binds a `Vendor` to a `Booking`:

| Field Name | Type | Constraints | Description |
|---|---|---|---|
| `id` | `String` | `@id @default(cuid())` | Unique assignment ID |
| `bookingId` | `String` | `@relation(Booking)` | Linked event booking |
| `vendorId` | `String` | `@relation(Vendor)` | Linked vendor master |
| `role` | `String?` | Optional | Specific role (e.g., "Lead Photographer") |
| `agreedRate` | `Decimal?` | `@db.Decimal(12, 2)` | Agreed financial payout rate |
| `notes` | `String?` | Optional | Special operational notes |
