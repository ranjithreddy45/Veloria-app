# 17 - Inventory System Overview

---

## 📦 Inventory Subsystem Architecture

The inventory subsystem (`src/actions/inventory.actions.ts`) manages general venue equipment, assets, cutlery, AV gear, and banquet supplies.

```prisma
// CODE VERIFIED: prisma/schema.prisma
model InventoryItem {
  id           String                 @id @default(cuid())
  name         String
  sku          String?                @unique
  category     String?                // ASSET | CUTLERY | DECOR | AV | SUPPLIES
  description  String?                @db.Text
  totalQuantity Int                   @default(0)
  availableQty Int                    @default(0)
  reorderLevel Int                    @default(0)
  unitPrice    Decimal?               @db.Decimal(10, 2)
  unit         String?                // PCS | SET | BOX | PAIR
  location     String?                // Main Warehouse | Hall A Store
  reservations InventoryReservation[]
}
```

- **Date Holds (`InventoryReservation`)**: Locks stock items for specific booking dates (`bookingId`, `quantity`, `date`, `returnDate`).
