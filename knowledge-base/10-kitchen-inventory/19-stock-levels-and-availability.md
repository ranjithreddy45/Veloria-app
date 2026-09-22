# 19 - Stock Levels & Date Availability

---

## 📊 Stock Availability Formula

```
Available Quantity = totalQuantity - activeReservations(on Target Date)
```

- **Reservation Action (`reserveForBooking`)**:
  ```typescript
  // CODE VERIFIED: src/actions/inventory.actions.ts
  export async function reserveForBooking(data: InventoryReservationInput) {
    // Validates availableQty >= requested quantity
    // Inserts InventoryReservation (status = RESERVED)
    // Decrements availableQty
  }
  ```
- **Release Action (`releaseReservation`)**: Restores `availableQty` upon item return or booking cancellation.
