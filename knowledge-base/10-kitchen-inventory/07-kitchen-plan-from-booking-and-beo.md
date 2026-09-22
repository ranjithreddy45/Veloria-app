# 07 - Kitchen Plan from Booking & BEO

---

## 📋 Data Inheritance Mapping

| Source Entity | Origin Field | Target KitchenPlan Attribute | Transformation Notes |
|---|---|---|---|
| `Booking` | `id` | `KitchenPlan.bookingId` | Foreign key reference |
| `Beo` | `id` | `KitchenPlan.beoId` | Foreign key reference |
| `Beo` | `covers` | `KitchenPlan.covers` | Inherits active headcount |
| `Beo` | `coversSource` | `KitchenPlan.coversSource` | Inherits source (`CONTRACTED`, `RSVP_CONFIRMED`, `MANUAL`) |
| `BookingMenu` | `items` | `KitchenPlanItem` List | Chef selects menu items to populate plan preparation rows |
