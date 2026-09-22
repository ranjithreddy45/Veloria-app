# 24 - Seating Chart & Operations

---

## 🪑 Seating Builder & Layout Execution (`SeatingChart`)

```prisma
// CODE VERIFIED: prisma/schema.prisma
model SeatingChart {
  id        String         @id @default(cuid())
  name      String
  rows      Int
  columns   Int
  bookingId String         @unique
  tables    SeatingTable[]
}
```

- **Interactive Seating Builder (`src/actions/seating.actions.ts`)**: Allows hosts and coordinators to arrange grid tables (`SeatingTable`) and assign guest seat numbers (`SeatingGuest`).
- **Banquet Floor Plan Printout**: The seating grid exports to a 2D floorplan PDF for steward placement and table card positioning.
