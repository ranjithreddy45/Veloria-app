# 04 - Kitchen Plan Creation Workflow

---

## 📌 Kitchen Plan Creation (`createKitchenPlan`)

Kitchen prep plans are created manually by the Head Chef or Banquet Manager for confirmed bookings:

```mermaid
sequenceDiagram
    autonumber
    actor Chef as Head Chef
    participant UI as Kitchen Dashboard (/kitchen)
    participant Action as kitchen.actions.ts
    participant DB as PostgreSQL Database

    Chef->>UI: Select "New Kitchen Plan" for Bookable Event
    UI->>Action: Call `createKitchenPlan({ bookingId, beoId, covers, notes })`
    Action->>DB: Query Booking & Beo to verify status
    Action->>DB: Read `Beo.covers` and `Beo.coversSource`
    Action->>DB: Insert `KitchenPlan` record (status = DRAFT)
    Action-->>UI: Return KitchenPlan object & redirect to `/kitchen/[id]`
```

---

## 📋 Field Inheritance & Rules
- **`bookingId`**: Foreign key linking plan to originating `Booking`.
- **`beoId`**: Optional foreign key linking plan to `Beo` function sheet.
- **`covers`**: Inherited from `Beo.covers` or `Booking.guestCount`.
- **`coversSource`**: Inherited from `Beo.coversSource` (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`).
- **`status`**: Initialized to `DRAFT`.
- **`estFoodCost`**: Initialized to `0.00` until plan items are added.
