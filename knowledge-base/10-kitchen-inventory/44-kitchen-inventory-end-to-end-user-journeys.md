# 44 - Kitchen & Inventory User Journeys

---

## 🛤️ Supported Operational Journeys

### Journey A: Head Chef Manages Kitchen Prep Plan & Food Costs
```
Head Chef views Kitchen Dashboard (/kitchen)
  -> Clicks "New Kitchen Plan" for Confirmed Booking
  -> Action `createKitchenPlan` mints DRAFT plan with BEO covers
  -> Chef adds plan items (`addPlanItem`), entering quantity & estimated unit costs
  -> System computes `estFoodCost` = ∑ (quantity × estUnitCost)
  -> On event day, Chef starts prep (`status = IN_PROGRESS`) and completes cooking (`status = COMPLETED`)
  -> Chef enters actual unit costs (`actualUnitCost`), and system computes `actualFoodCost` & variance %
```

### Journey B: Storekeeper Manages Asset Reservation for Event
```
Storekeeper opens Inventory (/inventory)
  -> Selects asset (e.g. Chafing Dishes, 50 sets available)
  -> Clicks "Reserve for Booking" (`reserveForBooking`)
  -> System checks `availableQty >= 50`, creates `InventoryReservation` (status = RESERVED)
  -> System decrements `availableQty` by 50 for target booking date
  -> Post-event, Storekeeper clicks `releaseReservation`, restoring `availableQty`
```
