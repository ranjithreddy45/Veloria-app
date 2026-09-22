# 40 - Kitchen & Inventory Server Actions Inventory

---

## ⚡ Server Actions Registry

| Action Name | File Location | Purpose | Key Parameters | Return Type |
|---|---|---|---|---|
| `getKitchenPlans` | `kitchen.actions.ts` | Fetches filtered kitchen plans | `filters` | `Promise<KitchenPlan[]>` |
| `getKitchenPlan` | `kitchen.actions.ts` | Fetches single kitchen plan detail | `id: string` | `Promise<KitchenPlan>` |
| `createKitchenPlan` | `kitchen.actions.ts` | Creates new kitchen prep plan | `data` | `Promise<KitchenPlan>` |
| `updateKitchenPlan` | `kitchen.actions.ts` | Updates plan status/notes | `planId, data` | `Promise<KitchenPlan>` |
| `addPlanItem` | `kitchen.actions.ts` | Adds item to kitchen plan | `planId, item` | `Promise<KitchenPlanItem>` |
| `updatePlanItem` | `kitchen.actions.ts` | Updates item actual unit cost | `itemId, patch` | `Promise<KitchenPlanItem>` |
| `getItems` | `inventory.actions.ts` | Fetches inventory item list | `params` | `Promise<InventoryItem[]>` |
| `createItem` | `inventory.actions.ts` | Creates new inventory item | `data` | `Promise<InventoryItem>` |
| `reserveForBooking` | `inventory.actions.ts` | Reserves stock for event date | `data` | `Promise<InventoryReservation>` |
| `releaseReservation` | `inventory.actions.ts` | Releases asset reservation | `reservationId` | `Promise<InventoryReservation>` |
| `getPurchaseRequisitions` | `procurement.actions.ts` | Fetches purchase requisitions | `params` | `Promise<PRDTO[]>` |
| `approvePR` | `procurement.actions.ts` | Approves purchase requisition | `id: string` | `Promise<PRDTO>` |
| `markReceived` | `procurement.actions.ts` | Marks PR received & posts GL entry | `id: string` | `Promise<PRDTO>` |
