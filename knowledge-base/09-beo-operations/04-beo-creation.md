# 04 - BEO Creation Pathways

---

## 📌 BEO Creation Flow (`createBeo`)

BEO function sheets are instantiated directly from a confirmed `Booking`:

```mermaid
sequenceDiagram
    autonumber
    actor Ops as Operations Manager
    participant UI as BEO Dashboard (/beo)
    participant Action as beo.actions.ts
    participant DB as PostgreSQL Database

    Ops->>UI: Select "Create BEO" for Booking
    UI->>Action: Call `createBeo(bookingId)`
    Action->>DB: Query Booking, Venue, Contact & BookingMenu
    Action->>DB: Generate sequential `beoNumber` (e.g. `BEO-2026-0108`)
    Action->>DB: Create `Beo` record (status = DRAFT, covers = Booking.guestCount, coversSource = CONTRACTED)
    Action-->>UI: Return new Beo object & redirect to `/beo/[id]`
```

---

## 📋 Field Inheritance Rules
- `beoNumber`: Generated via sequential format `BEO-{YYYY}-{SEQ}`.
- `bookingId`: Direct foreign key link to originating `Booking`.
- `status`: Default initial state `DRAFT`.
- `covers`: Initialized from `Booking.guestCount`.
- `coversSource`: Default `CONTRACTED`.
- `runOfShow`: Initialized with default banquet timeline JSON array.
