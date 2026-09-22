# 35 - BEO & Operations Server Actions & API Inventory

---

## ⚡ Server Actions Registry

| Action Name | Location File | Purpose | Parameters | Return Type |
|---|---|---|---|---|
| `getBeos` | `beo.actions.ts` | Fetches filtered BEO list | `filters` | `Promise<Beo[]>` |
| `getBeo` | `beo.actions.ts` | Fetches single BEO detail | `id: string` | `Promise<Beo>` |
| `createBeo` | `beo.actions.ts` | Creates BEO for booking | `bookingId: string` | `Promise<Beo>` |
| `updateBeo` | `beo.actions.ts` | Updates BEO (blocked if LOCKED) | `beoId, patch` | `Promise<Beo>` |
| `setBeoStatus` | `beo.actions.ts` | Transitions BEO status | `beoId, status` | `Promise<Beo>` |
| `addBeoIncident` | `beo.actions.ts` | Logs BEO incident | `beoId, data` | `Promise<BeoIncident>` |
| `resolveBeoIncident` | `beo.actions.ts` | Resolves BEO incident | `incidentId: string` | `Promise<BeoIncident>` |
| `reportIncident` | `emergency.actions.ts` | Reports emergency incident | `data: EmergencyIncidentInput` | `Promise<EmergencyIncident>` |
| `resolveIncident` | `emergency.actions.ts` | Resolves emergency incident | `data: ResolveIncidentInput` | `Promise<EmergencyIncident>` |
| `getOperationReadinessForBooking` | `ops-readiness.actions.ts` | Computes 7-gate readiness | `bookingId: string` | `Promise<ReadinessResult>` |
| `createKitchenPlan` | `kitchen.actions.ts` | Mints kitchen prep plan | `data` | `Promise<KitchenPlan>` |
| `createWorkOrder` | `work-order.actions.ts` | Mints vendor work order | `data` | `Promise<WorkOrder>` |
| `signWorkOrder` | `work-order.actions.ts` | Vendor signs work order | `workOrderId, signature` | `Promise<WorkOrder>` |
