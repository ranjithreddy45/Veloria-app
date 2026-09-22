# 07 - Booking Identifiers & Numbering System

---

## 🔢 Identifier Formats & Generation Engine

Veloria Grand enforces standardized, human-readable, unique identifiers across all booking and event records:

```typescript
// CODE VERIFIED: src/actions/booking.actions.ts
export async function generateBookingNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.booking.count();
  const sequence = String(count + 1).padStart(4, '0');
  return `VG-BK-${year}-${sequence}`;
}
```

---

## 🗂️ Related Sub-System Identifiers

| Entity | Identifier Format | Example | Uniqueness Constraint |
|---|---|---|---|
| **Booking** | `VG-BK-{YYYY}-{SEQ}` | `VG-BK-2026-0042` | Global `@unique` index on `Booking.bookingNumber` |
| **BEO Sheet** | `BEO-{YYYY}-{SEQ}` | `BEO-2026-0108` | Global `@unique` index on `Beo.beoNumber` |
| **Public Hold Token** | UUID / Hex Token | `ph_tk_8f93a1b2c4` | Global `@unique` index on `PublicHold.token` |
| **Guest RSVP Token** | Base64 / Hex Token | `grsvp_99a8b7c6` | Global `@index` on `Booking.guestConfirmationToken` |
